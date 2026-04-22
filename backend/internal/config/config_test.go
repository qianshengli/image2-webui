package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestValidateProxyConfig(t *testing.T) {
	cfg := &Config{
		Proxy: ProxyConfig{
			Enabled: true,
			URL:     "socks5h://127.0.0.1:10808",
			Mode:    "fixed",
		},
	}

	if err := cfg.validate(); err != nil {
		t.Fatalf("expected valid proxy config, got %v", err)
	}
}

func TestValidateRejectsUnsupportedProxyMode(t *testing.T) {
	cfg := &Config{
		Proxy: ProxyConfig{
			Enabled: true,
			URL:     "socks5h://127.0.0.1:10808",
			Mode:    "singbox",
		},
	}

	if err := cfg.validate(); err == nil {
		t.Fatal("expected unsupported mode validation error")
	}
}

func TestProxyURLs(t *testing.T) {
	cfg := &Config{
		Proxy: ProxyConfig{
			Enabled:     true,
			URL:         "socks5h://127.0.0.1:10808",
			Mode:        "fixed",
			SyncEnabled: false,
		},
	}

	if got := cfg.ChatGPTProxyURL(); got != "socks5h://127.0.0.1:10808" {
		t.Fatalf("unexpected chatgpt proxy url %q", got)
	}
	if got := cfg.SyncProxyURL(); got != "" {
		t.Fatalf("expected sync proxy to be disabled, got %q", got)
	}

	cfg.Proxy.SyncEnabled = true
	if got := cfg.SyncProxyURL(); got != "socks5h://127.0.0.1:10808" {
		t.Fatalf("unexpected sync proxy url %q", got)
	}
}

func TestDetectConfigRootFindsBackendFromRepoRoot(t *testing.T) {
	rootDir := t.TempDir()
	backendDir := filepath.Join(rootDir, "backend")
	backendDataDir := filepath.Join(backendDir, "data")
	if err := os.MkdirAll(backendDir, 0o755); err != nil {
		t.Fatalf("mkdir backend: %v", err)
	}
	if err := os.MkdirAll(backendDataDir, 0o755); err != nil {
		t.Fatalf("mkdir backend data: %v", err)
	}
	if err := os.WriteFile(filepath.Join(backendDataDir, defaultConfigFile), []byte(""), 0o644); err != nil {
		t.Fatalf("write defaults: %v", err)
	}

	got := detectConfigRoot(rootDir)
	if got != backendDir {
		t.Fatalf("expected detected root %q, got %q", backendDir, got)
	}
}
