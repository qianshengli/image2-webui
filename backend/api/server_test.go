package api

import (
	"errors"
	"testing"

	"chatgpt2api/internal/accounts"
	"chatgpt2api/internal/config"
)

func TestShouldUseOfficialResponses(t *testing.T) {
	tests := []struct {
		name              string
		preferredAccount  bool
		responsesEligible bool
		configuredRoute   string
		want              bool
	}{
		{
			name:              "paid account with eligible request uses responses",
			responsesEligible: true,
			configuredRoute:   "responses",
			want:              true,
		},
		{
			name:              "paid account with ineligible payload stays legacy",
			responsesEligible: false,
			configuredRoute:   "responses",
			want:              false,
		},
		{
			name:              "preferred source account stays legacy",
			preferredAccount:  true,
			responsesEligible: true,
			configuredRoute:   "responses",
			want:              false,
		},
		{
			name:              "legacy route stays legacy",
			responsesEligible: true,
			configuredRoute:   "legacy",
			want:              false,
		},
		{
			name:              "unknown route falls back to legacy",
			responsesEligible: true,
			configuredRoute:   "something-else",
			want:              false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := shouldUseOfficialResponses(tt.preferredAccount, tt.responsesEligible, tt.configuredRoute); got != tt.want {
				t.Fatalf("shouldUseOfficialResponses() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestConfiguredImageRoute(t *testing.T) {
	server := &Server{
		cfg: &config.Config{
			ChatGPT: config.ChatGPTConfig{
				FreeImageRoute: "responses",
				PaidImageRoute: "legacy",
			},
		},
	}

	if got := server.configuredImageRoute("Free"); got != "responses" {
		t.Fatalf("configuredImageRoute(Free) = %q, want %q", got, "responses")
	}
	if got := server.configuredImageRoute("Plus"); got != "legacy" {
		t.Fatalf("configuredImageRoute(Plus) = %q, want %q", got, "legacy")
	}
}

func TestResolveImageUpstreamModelFromConfig(t *testing.T) {
	server := &Server{
		cfg: &config.Config{
			ChatGPT: config.ChatGPTConfig{
				FreeImageModel: "auto",
				PaidImageModel: "gpt-5.4",
			},
		},
	}

	if got := server.resolveImageUpstreamModel("gpt-image-1", "Plus"); got != "gpt-5.4" {
		t.Fatalf("resolveImageUpstreamModel() = %q, want %q", got, "gpt-5.4")
	}
	if got := server.resolveImageUpstreamModel("gpt-image-2", "Free"); got != "auto" {
		t.Fatalf("resolveImageUpstreamModel() = %q, want %q", got, "auto")
	}
}

func TestResolveImageAcquireError(t *testing.T) {
	lastErr := errors.New("refresh failed")
	noAvailableErr := errors.New("read dir failed")

	tests := []struct {
		name             string
		mode             string
		err              error
		lastRetryableErr error
		wantMessage      string
		wantCode         string
	}{
		{
			name:        "cpa mode still maps empty pool when helper is used",
			mode:        "cpa",
			err:         accounts.ErrNoAvailableImageAuth,
			wantMessage: "当前没有可用的图片账号用于 CPA 模式",
			wantCode:    "no_cpa_image_accounts",
		},
		{
			name:             "retry exhaustion keeps last real error",
			mode:             "cpa",
			err:              accounts.ErrNoAvailableImageAuth,
			lastRetryableErr: lastErr,
			wantMessage:      lastErr.Error(),
		},
		{
			name:        "non sentinel error passes through",
			mode:        "cpa",
			err:         noAvailableErr,
			wantMessage: noAvailableErr.Error(),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := resolveImageAcquireError(tt.mode, tt.err, tt.lastRetryableErr)
			if got == nil {
				t.Fatal("resolveImageAcquireError() returned nil")
			}
			if got.Error() != tt.wantMessage {
				t.Fatalf("resolveImageAcquireError() error = %q, want %q", got.Error(), tt.wantMessage)
			}
			if tt.wantCode != "" && requestErrorCode(got) != tt.wantCode {
				t.Fatalf("resolveImageAcquireError() code = %q, want %q", requestErrorCode(got), tt.wantCode)
			}
		})
	}
}
