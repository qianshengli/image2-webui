package handler

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestResolveChatGPTAccountIDFromAccessToken(t *testing.T) {
	payload, err := json.Marshal(map[string]any{
		"https://api.openai.com/auth": map[string]any{
			"chatgpt_account_id": "acct-123",
		},
	})
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	accessToken := "header." + strings.TrimRight(base64.URLEncoding.EncodeToString(payload), "=") + ".sig"
	if got := resolveChatGPTAccountID(accessToken, map[string]any{}); got != "acct-123" {
		t.Fatalf("resolveChatGPTAccountID() = %q, want %q", got, "acct-123")
	}
}

func TestDecodeImageDataURL(t *testing.T) {
	dataURL := encodeImageDataURL([]byte("hello"), "image/png")
	got, err := decodeImageDataURL(dataURL)
	if err != nil {
		t.Fatalf("decodeImageDataURL() returned error: %v", err)
	}
	if string(got) != "hello" {
		t.Fatalf("decodeImageDataURL() = %q, want %q", string(got), "hello")
	}
}

func TestParseResponsesSSEDeduplicatesFinalImages(t *testing.T) {
	stream := strings.Join([]string{
		`data: {"type":"response.output_item.done","item":{"type":"image_generation_call","result":"aGVsbG8=","output_format":"png"}}`,
		"",
		`data: {"type":"response.completed","response":{"output":[{"type":"image_generation_call","result":"aGVsbG8=","output_format":"png"}]}}`,
		"",
		`data: [DONE]`,
		"",
	}, "\n")

	client := &ResponsesClient{}
	images, err := client.parseResponsesSSE(strings.NewReader(stream), "prompt")
	if err != nil {
		t.Fatalf("parseResponsesSSE() returned error: %v", err)
	}
	if len(images) != 1 {
		t.Fatalf("parseResponsesSSE() len = %d, want %d", len(images), 1)
	}
	if got, want := images[0].URL, "data:image/png;base64,aGVsbG8="; got != want {
		t.Fatalf("parseResponsesSSE() url = %q, want %q", got, want)
	}
}

func TestSupportsResponsesInlineEdit(t *testing.T) {
	tests := []struct {
		name   string
		images [][]byte
		mask   []byte
		want   bool
	}{
		{
			name:   "single small image is allowed",
			images: [][]byte{make([]byte, 32*1024)},
			want:   true,
		},
		{
			name:   "multiple images are rejected",
			images: [][]byte{make([]byte, 8), make([]byte, 8)},
			want:   false,
		},
		{
			name:   "large image payload is rejected",
			images: [][]byte{make([]byte, maxResponsesInlineBytes+1)},
			want:   false,
		},
		{
			name:   "image plus mask over threshold is rejected",
			images: [][]byte{make([]byte, maxResponsesInlineBytes-16)},
			mask:   make([]byte, 32),
			want:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := SupportsResponsesInlineEdit(tt.images, tt.mask); got != tt.want {
				t.Fatalf("SupportsResponsesInlineEdit() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestNewResponsesClientWithProxyAndConfigUsesProvidedSSETimeout(t *testing.T) {
	requestConfig := ImageRequestConfig{
		RequestTimeout: 15 * time.Second,
		SSETimeout:     75 * time.Second,
		PollInterval:   4 * time.Second,
		PollMaxWait:    33 * time.Second,
	}

	client := NewResponsesClientWithProxyAndConfig("token", "http://proxy.local", map[string]any{
		"account_id": "acct-1",
	}, requestConfig)

	if client.httpClient.Timeout != requestConfig.SSETimeout+30*time.Second {
		t.Fatalf("responses stream timeout = %v, want %v", client.httpClient.Timeout, requestConfig.SSETimeout+30*time.Second)
	}
	if client.backend.httpClient.Timeout != requestConfig.RequestTimeout {
		t.Fatalf("backend request timeout = %v, want %v", client.backend.httpClient.Timeout, requestConfig.RequestTimeout)
	}
	if client.backend.pollInterval != requestConfig.PollInterval {
		t.Fatalf("backend poll interval = %v, want %v", client.backend.pollInterval, requestConfig.PollInterval)
	}
	if client.backend.pollMaxWait != requestConfig.PollMaxWait {
		t.Fatalf("backend poll max wait = %v, want %v", client.backend.pollMaxWait, requestConfig.PollMaxWait)
	}
}
