package api

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type siteUser struct {
	ID         string `json:"id"`
	Username   string `json:"username"`
	Password   string `json:"password"`
	TotalQuota int    `json:"total_quota"`
	UsedQuota  int    `json:"used_quota"`
	UsageDate  string `json:"usage_date"`
	Disabled   bool   `json:"disabled"`
	CreatedAt  string `json:"created_at"`
	UpdatedAt  string `json:"updated_at"`
}

type siteUserStore struct {
	mu       sync.RWMutex
	filePath string
	users    []siteUser
	sessions map[string]string
}

func newSiteUserStore(filePath string) *siteUserStore {
	store := &siteUserStore{filePath: filePath, sessions: map[string]string{}}
	_ = store.load()
	return store
}

func (s *siteUserStore) load() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := os.MkdirAll(filepath.Dir(s.filePath), 0o755); err != nil {
		return err
	}
	data, err := os.ReadFile(s.filePath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			now := time.Now().UTC().Format(time.RFC3339)
			today := time.Now().Format("2006-01-02")
			s.users = []siteUser{{ID: "demo-user", Username: "demo", Password: "demo123", TotalQuota: 20, UsedQuota: 0, UsageDate: today, Disabled: false, CreatedAt: now, UpdatedAt: now}}
			return s.saveLocked()
		}
		return err
	}
	if len(data) == 0 {
		return nil
	}
	if err := json.Unmarshal(data, &s.users); err != nil {
		return err
	}
	if s.normalizeDailyUsageLocked() {
		return s.saveLocked()
	}
	return nil
}

func (s *siteUserStore) normalizeDailyUsageLocked() bool {
	today := time.Now().Format("2006-01-02")
	changed := false
	for idx := range s.users {
		if strings.TrimSpace(s.users[idx].UsageDate) == "" {
			s.users[idx].UsageDate = today
			changed = true
		}
		if s.users[idx].UsageDate != today {
			s.users[idx].UsageDate = today
			s.users[idx].UsedQuota = 0
			s.users[idx].UpdatedAt = time.Now().UTC().Format(time.RFC3339)
			changed = true
		}
	}
	return changed
}

func (s *siteUserStore) saveLocked() error {
	data, err := json.MarshalIndent(s.users, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, data, 0o644)
}

func (s *siteUserStore) list() []siteUser {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.normalizeDailyUsageLocked() {
		_ = s.saveLocked()
	}
	items := make([]siteUser, 0, len(s.users))
	items = append(items, s.users...)
	return items
}

func (s *siteUserStore) create(username, password string, totalQuota int) ([]siteUser, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	username = strings.TrimSpace(username)
	if username == "" || strings.TrimSpace(password) == "" {
		return nil, errors.New("username and password are required")
	}
	for _, user := range s.users {
		if user.Username == username {
			return nil, errors.New("username already exists")
		}
	}
	now := time.Now().UTC().Format(time.RFC3339)
	today := time.Now().Format("2006-01-02")
	s.users = append([]siteUser{{
		ID:         "u_" + now,
		Username:   username,
		Password:   password,
		TotalQuota: max(0, totalQuota),
		UsedQuota:  0,
		UsageDate:  today,
		Disabled:   false,
		CreatedAt:  now,
		UpdatedAt:  now,
	}}, s.users...)
	if err := s.saveLocked(); err != nil {
		return nil, err
	}
	items := make([]siteUser, 0, len(s.users))
	items = append(items, s.users...)
	return items, nil
}

func (s *siteUserStore) update(userID string, payload map[string]any) ([]siteUser, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.normalizeDailyUsageLocked() {
		_ = s.saveLocked()
	}
	for idx := range s.users {
		if s.users[idx].ID != userID {
			continue
		}
		if value, ok := payload["password"].(string); ok && strings.TrimSpace(value) != "" {
			s.users[idx].Password = value
		}
		if value, ok := payload["total_quota"].(float64); ok {
			s.users[idx].TotalQuota = max(0, int(value))
		}
		if value, ok := payload["used_quota"].(float64); ok {
			s.users[idx].UsedQuota = max(0, int(value))
		}
		if value, ok := payload["disabled"].(bool); ok {
			s.users[idx].Disabled = value
		}
		s.users[idx].UpdatedAt = time.Now().UTC().Format(time.RFC3339)
		if err := s.saveLocked(); err != nil {
			return nil, err
		}
		items := make([]siteUser, 0, len(s.users))
		items = append(items, s.users...)
		return items, nil
	}
	return nil, errors.New("site user not found")
}

func (s *siteUserStore) delete(userID string) ([]siteUser, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	filtered := make([]siteUser, 0, len(s.users))
	for _, user := range s.users {
		if user.ID != userID {
			filtered = append(filtered, user)
		}
	}
	s.users = filtered
	for token, id := range s.sessions {
		if id == userID {
			delete(s.sessions, token)
		}
	}
	if err := s.saveLocked(); err != nil {
		return nil, err
	}
	items := make([]siteUser, 0, len(s.users))
	items = append(items, s.users...)
	return items, nil
}

func randomToken() string {
	buf := make([]byte, 16)
	_, _ = rand.Read(buf)
	return hex.EncodeToString(buf)
}

func (s *siteUserStore) login(username, password string) (siteUser, string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.normalizeDailyUsageLocked() {
		_ = s.saveLocked()
	}
	for _, user := range s.users {
		if user.Username == strings.TrimSpace(username) && user.Password == password {
			if user.Disabled {
				return siteUser{}, "", errors.New("site user disabled")
			}
			token := randomToken()
			s.sessions[token] = user.ID
			return user, token, nil
		}
	}
	return siteUser{}, "", errors.New("username or password is invalid")
}

func (s *siteUserStore) userByToken(token string) (siteUser, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.normalizeDailyUsageLocked() {
		_ = s.saveLocked()
	}
	userID := s.sessions[strings.TrimSpace(token)]
	if userID == "" {
		return siteUser{}, false
	}
	for _, user := range s.users {
		if user.ID == userID {
			return user, !user.Disabled
		}
	}
	return siteUser{}, false
}

func (s *siteUserStore) consume(userID string, amount int) (siteUser, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.normalizeDailyUsageLocked() {
		_ = s.saveLocked()
	}
	for idx := range s.users {
		if s.users[idx].ID != userID {
			continue
		}
		remaining := max(0, s.users[idx].TotalQuota-s.users[idx].UsedQuota)
		if remaining < amount {
			return siteUser{}, errors.New("quota not enough")
		}
		s.users[idx].UsedQuota += amount
		s.users[idx].UpdatedAt = time.Now().UTC().Format(time.RFC3339)
		if err := s.saveLocked(); err != nil {
			return siteUser{}, err
		}
		return s.users[idx], nil
	}
	return siteUser{}, errors.New("site user not found")
}

func (s *Server) handleSiteUserLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	user, token, err := s.siteUsers.login(body.Username, body.Password)
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "user": user})
}

func (s *Server) handleSiteUserMe(w http.ResponseWriter, r *http.Request) {
	user, ok := s.siteUserFromRequest(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "site user unauthorized")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

func (s *Server) handleConsumeSiteUserQuota(w http.ResponseWriter, r *http.Request) {
	user, ok := s.siteUserFromRequest(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "site user unauthorized")
		return
	}
	var body struct {
		Amount int `json:"amount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.Amount <= 0 {
		body.Amount = 1
	}
	next, err := s.siteUsers.consume(user.ID, body.Amount)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": next})
}

func (s *Server) handleListSiteUsers(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"items": s.siteUsers.list()})
}

func (s *Server) handleCreateSiteUser(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username   string `json:"username"`
		Password   string `json:"password"`
		TotalQuota int    `json:"total_quota"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	items, err := s.siteUsers.create(body.Username, body.Password, body.TotalQuota)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) handleUpdateSiteUser(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	userID := strings.TrimSpace(stringValue(body["id"]))
	if userID == "" {
		writeError(w, http.StatusBadRequest, "id is required")
		return
	}
	items, err := s.siteUsers.update(userID, body)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) handleDeleteSiteUser(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	items, err := s.siteUsers.delete(strings.TrimSpace(body.ID))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) siteUserFromRequest(r *http.Request) (siteUser, bool) {
	if s == nil || s.siteUsers == nil {
		return siteUser{}, false
	}
	token := strings.TrimSpace(r.Header.Get("X-Site-User-Token"))
	if token == "" {
		return siteUser{}, false
	}
	return s.siteUsers.userByToken(token)
}

func (s *Server) requireSiteUserAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := s.siteUserFromRequest(r); !ok {
			writeError(w, http.StatusUnauthorized, "site user unauthorized")
			return
		}
		next.ServeHTTP(w, r)
	})
}
