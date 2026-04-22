package api

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"chatgpt2api/handler"
)

type cpaImageClient struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

func newCPAImageClient(baseURL, apiKey string, timeout time.Duration) *cpaImageClient {
	if timeout <= 0 {
		timeout = 60 * time.Second
	}
	return &cpaImageClient{
		baseURL: strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		apiKey:  strings.TrimSpace(apiKey),
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}
}

func (c *cpaImageClient) DownloadBytes(url string) ([]byte, error) {
	if payload, err := decodeCPAImageDataURL(url); err == nil {
		return payload, nil
	}

	req, err := http.NewRequest(http.MethodGet, strings.TrimSpace(url), nil)
	if err != nil {
		return nil, fmt.Errorf("create image request: %w", err)
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("download image: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("download image returned %d", resp.StatusCode)
	}
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read image: %w", err)
	}
	return data, nil
}

func (c *cpaImageClient) DownloadAsBase64(ctx context.Context, url string) (string, error) {
	if payload, err := decodeCPAImageDataURL(url); err == nil {
		return base64.StdEncoding.EncodeToString(payload), nil
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimSpace(url), nil)
	if err != nil {
		return "", fmt.Errorf("create image request: %w", err)
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("download image: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("download image returned %d", resp.StatusCode)
	}
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read image: %w", err)
	}
	return base64.StdEncoding.EncodeToString(data), nil
}

func (c *cpaImageClient) GenerateImage(ctx context.Context, prompt, model string, n int, size, quality, background string) ([]handler.ImageResult, error) {
	body := map[string]any{
		"prompt":          strings.TrimSpace(prompt),
		"model":           strings.TrimSpace(model),
		"n":               max(1, n),
		"response_format": "b64_json",
	}
	if strings.TrimSpace(size) != "" {
		body["size"] = strings.TrimSpace(size)
	}
	if strings.TrimSpace(quality) != "" {
		body["quality"] = strings.TrimSpace(quality)
	}
	if strings.TrimSpace(background) != "" {
		body["background"] = strings.TrimSpace(background)
	}
	return c.executeJSONRequest(ctx, "/v1/images/generations", body)
}

func (c *cpaImageClient) EditImageByUpload(ctx context.Context, prompt, model string, images [][]byte, mask []byte) ([]handler.ImageResult, error) {
	if len(images) == 0 {
		return nil, fmt.Errorf("at least one image is required")
	}

	var payload bytes.Buffer
	writer := multipart.NewWriter(&payload)
	_ = writer.WriteField("prompt", strings.TrimSpace(prompt))
	_ = writer.WriteField("model", strings.TrimSpace(model))
	_ = writer.WriteField("response_format", "b64_json")

	for index, image := range images {
		part, err := writer.CreateFormFile("image", fmt.Sprintf("image-%d.png", index+1))
		if err != nil {
			return nil, fmt.Errorf("create image form field: %w", err)
		}
		if _, err := part.Write(image); err != nil {
			return nil, fmt.Errorf("write image form field: %w", err)
		}
	}
	if len(mask) > 0 {
		part, err := writer.CreateFormFile("mask", "mask.png")
		if err != nil {
			return nil, fmt.Errorf("create mask form field: %w", err)
		}
		if _, err := part.Write(mask); err != nil {
			return nil, fmt.Errorf("write mask form field: %w", err)
		}
	}
	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("close multipart writer: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/v1/images/edits", &payload)
	if err != nil {
		return nil, fmt.Errorf("create CPA edit request: %w", err)
	}
	c.setAuth(req)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("cpa image edit request: %w", err)
	}
	defer resp.Body.Close()
	return c.parseResponse(resp)
}

func (c *cpaImageClient) InpaintImageByMask(
	ctx context.Context,
	prompt string,
	model string,
	originalFileID string,
	originalGenID string,
	conversationID string,
	parentMessageID string,
	mask []byte,
) ([]handler.ImageResult, error) {
	return nil, newRequestError("source_context_missing", "CPA 路由不支持上下文选区编辑，将自动回退为源图加遮罩编辑")
}

func (c *cpaImageClient) executeJSONRequest(ctx context.Context, path string, body map[string]any) ([]handler.ImageResult, error) {
	raw, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal CPA image request: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(raw))
	if err != nil {
		return nil, fmt.Errorf("create CPA image request: %w", err)
	}
	c.setAuth(req)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("cpa image request: %w", err)
	}
	defer resp.Body.Close()
	return c.parseResponse(resp)
}

func (c *cpaImageClient) parseResponse(resp *http.Response) ([]handler.ImageResult, error) {
	body, err := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
	if err != nil {
		return nil, fmt.Errorf("read CPA response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("cpa returned %d: %s", resp.StatusCode, summarizeCPAError(body))
	}

	var payload struct {
		Data []struct {
			URL           string `json:"url"`
			B64JSON       string `json:"b64_json"`
			RevisedPrompt string `json:"revised_prompt"`
			FileID        string `json:"file_id"`
			GenID         string `json:"gen_id"`
			ConversationID string `json:"conversation_id"`
			ParentMessageID string `json:"parent_message_id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("decode CPA response: %w", err)
	}

	results := make([]handler.ImageResult, 0, len(payload.Data))
	for _, item := range payload.Data {
		imageURL := strings.TrimSpace(item.URL)
		if imageURL == "" && strings.TrimSpace(item.B64JSON) != "" {
			imageURL = encodeCPAImageDataURLFromBase64(strings.TrimSpace(item.B64JSON), "image/png")
		}
		if imageURL == "" {
			continue
		}
		results = append(results, handler.ImageResult{
			URL:            imageURL,
			FileID:         strings.TrimSpace(item.FileID),
			GenID:          strings.TrimSpace(item.GenID),
			ConversationID: strings.TrimSpace(item.ConversationID),
			ParentMsgID:    strings.TrimSpace(item.ParentMessageID),
			RevisedPrompt:  strings.TrimSpace(item.RevisedPrompt),
		})
	}
	if len(results) == 0 {
		return nil, fmt.Errorf("cpa did not return image output")
	}
	return results, nil
}

func (c *cpaImageClient) setAuth(req *http.Request) {
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
}

func summarizeCPAError(body []byte) string {
	var payload struct {
		Error *struct {
			Message string `json:"message"`
			Code    string `json:"code"`
		} `json:"error"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(body, &payload); err == nil {
		if payload.Error != nil && strings.TrimSpace(payload.Error.Message) != "" {
			return strings.TrimSpace(payload.Error.Message)
		}
		if strings.TrimSpace(payload.Message) != "" {
			return strings.TrimSpace(payload.Message)
		}
	}
	trimmed := strings.TrimSpace(string(body))
	if trimmed == "" {
		return "empty error response"
	}
	return trimmed
}

func encodeCPAImageDataURLFromBase64(encoded, mimeType string) string {
	trimmedMimeType := strings.TrimSpace(mimeType)
	if trimmedMimeType == "" {
		trimmedMimeType = "image/png"
	}
	return "data:" + trimmedMimeType + ";base64," + strings.TrimSpace(encoded)
}

func decodeCPAImageDataURL(value string) ([]byte, error) {
	trimmed := strings.TrimSpace(value)
	if !strings.HasPrefix(trimmed, "data:image/") {
		return nil, fmt.Errorf("not an image data url")
	}
	index := strings.Index(trimmed, ",")
	if index < 0 {
		return nil, fmt.Errorf("invalid image data url")
	}
	payload, err := base64.StdEncoding.DecodeString(trimmed[index+1:])
	if err != nil {
		return nil, fmt.Errorf("decode image data url: %w", err)
	}
	return payload, nil
}
