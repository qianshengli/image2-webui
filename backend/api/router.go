package api

import (
	"net/http"

	"image2webui/internal/accounts"
	"image2webui/internal/cliproxy"
	"image2webui/internal/config"
)

func SetupRouter(cfg *config.Config, store *accounts.Store, syncClient *cliproxy.Client) http.Handler {
	return NewServer(cfg, store, syncClient).Handler()
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok"})
}
