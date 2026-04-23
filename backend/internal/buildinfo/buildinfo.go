package buildinfo

import (
	"os/exec"
	"strings"
	"sync"
)

var (
	Version   = "dev"
	Commit    = "none"
	BuildTime = "unknown"

	versionOnce sync.Once
	cachedGitVersion string
)

func ResolveVersion(fallback string) string {
	version := strings.TrimSpace(Version)
	if version != "" && !strings.EqualFold(version, "dev") {
		return version
	}

	versionOnce.Do(func() {
		output, err := exec.Command("git", "describe", "--tags", "--always", "--dirty").Output()
		if err != nil {
			return
		}
		cachedGitVersion = strings.TrimSpace(string(output))
	})
	if cachedGitVersion != "" {
		return cachedGitVersion
	}

	fallback = strings.TrimSpace(fallback)
	if fallback != "" {
		return fallback
	}
	if version != "" {
		return version
	}
	return "unknown"
}
