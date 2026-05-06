package api

import (
	"net/http"

	"image2webui/internal/config"
)

func (s *Server) handleGetForbiddenWordsPreset(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"preset": config.DefaultForbiddenWordsPreset(),
	})
}

