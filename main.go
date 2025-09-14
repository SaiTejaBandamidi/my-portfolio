package main

import (
	"bytes"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

//go:embed web/*
var webFS embed.FS

// ------------------------------- Types ---------------------------------------

type Profile struct {
	Name     string       `json:"name"`
	Role     string       `json:"role"`
	Location string       `json:"location"`
	Email    string       `json:"email"`
	Links    []Link       `json:"links"`
	Skills   []string     `json:"skills"`
	Projects []ProjectRef `json:"projects"`
}

type Link struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

type ProjectRef struct {
	Title string   `json:"title"`
	Desc  string   `json:"desc"`
	Tags  []string `json:"tags"`
	URL   string   `json:"url"`
}

// ----------------------- Configurable Portfolio Data ------------------------

var profile = Profile{
	Name:     "Sai Teja Bandamidi",
	Role:     "Software Engineer — Software Development / Agile / Go / Python / SQL / GraphQL",
	Location: "Phoenix, AZ, USA",
	Email:    "saitejabatwork@gmail.com",
	Links: []Link{
		{Label: "GitHub", URL: "https://github.com/SaiTejaBandamidi"},
		{Label: "Blog", URL: "https://medium.com/@bsaiteja"},
	},
	Skills: []string{
		"GoLang", "Python", "Java",
		"HTML", "CSS", "JavaScript",
		"SQL", "REST APIs", "GraphQL",
		"MySQL", "NoSQL", "MongoDB", "PostgreSQL",
	},
	Projects: []ProjectRef{
		{
			Title: "Go GraphQL API (Harry Potter Demo)",
			Desc:  "gqlgen + SQLC + Postgres with optimized resolvers and tracing.",
			Tags:  []string{"Go", "GraphQL", "SQLC", "Postgres", "Tracing"},
			URL:   "https://github.com/SaiTejaBandamidi/go-graphql-sqlc-api",
		},
		{
			Title: "Personal Portfolio Website Jarvis-Inspired",
			Desc:  "An interactive AI-powered portfolio website styled after Iron Man's JARVIS HUD.",
			Tags:  []string{"Go", "HTML", "CSS", "JavaScript"},
			URL:   "https://github.com/SaiTejaBandamidi/my-portfolio",
		},
		{
			Title: "CashCard Application",
			Desc:  "A web app for managing cash cards and wallets with user accounts, balances, and transactions.",
			Tags:  []string{"Python", "Flask", "HTML", "CSS"},
			URL:   "https://github.com/SaiTejaBandamidi/CashCardApplication",
		},
		{
			Title: "Software Development Methodologies",
			Desc:  "A collection of coding exercises exploring different software development methodologies and coding practices.",
			Tags:  []string{"Python", "Jupyter", "Markdown"},
			URL:   "https://github.com/SaiTejaBandamidi/SoftwareDevelopmentMethodologies",
		},
		{
			Title: "Algorithm Implementations",
			Desc:  "Notebook-based projects implementing algorithms as part of coursework.",
			Tags:  []string{"Python", "Jupyter"},
			URL:   "https://github.com/SaiTejaBandamidi/SoftwareDevelopmentMethodologies",
		},
		{
			Title: "Programming and Problem Solving in Python",
			Desc:  "Programming exercises demonstrating problem-solving and coding best practices.",
			Tags:  []string{"Python", "Software Development"},
			URL:   "https://github.com/SaiTejaBandamidi/SoftwareDevelopmentMethodologies",
		},
		{
			Title: "Projects - WebScraping and File Processing in Python",
			Desc:  "Standalone Python scripts working with sequences and algorithms, showcasing coding fundamentals.",
			Tags:  []string{"Python", "File Processing", "Algorithms"},
			URL:   "https://github.com/SaiTejaBandamidi/SoftwareDevelopmentMethodologies",
		},
	},
}

// ------------------------- AI Cache (in-memory) ------------------------------

var (
	cache   = make(map[string]string)
	cacheMu sync.Mutex
)

// ------------------------------- Main ----------------------------------------

func main() {
	sub, _ := fs.Sub(webFS, "web")
	mux := http.NewServeMux()
	mux.Handle("/", http.FileServer(http.FS(sub)))

	mux.HandleFunc("/api/profile", handleProfile)
	mux.HandleFunc("/api/ping", handlePing)
	mux.HandleFunc("/api/ask", handleAsk)
	mux.HandleFunc("/sse", sseHandler)

	srv := &http.Server{
		Addr:    ":8080",
		Handler: securityHeaders(mux),
	}
	log.Printf("HUD online → http://localhost%s", srv.Addr)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}

// ------------------------------- Handlers ------------------------------------

func handleProfile(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(profile)
}

func handlePing(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"ok":  true,
		"now": time.Now().Format(time.RFC3339),
	})
}

// ----------------------------- AI Console ------------------------------------

func handleAsk(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var req struct {
		Q string `json:"q"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	q := strings.TrimSpace(req.Q)
	if q == "" {
		_ = json.NewEncoder(w).Encode(map[string]string{"a": "Ask me about my skills, work, or projects."})
		return
	}

	// 1. Check cache
	cacheMu.Lock()
	if ans, ok := cache[q]; ok {
		cacheMu.Unlock()
		log.Printf("[Cache] %s → %s", q, ans)
		_ = json.NewEncoder(w).Encode(map[string]string{"a": ans})
		return
	}
	cacheMu.Unlock()

	// 2. Try OpenAI
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey != "" {
		if a, err := askOpenAI(apiKey, q); err == nil && a != "" {
			cacheMu.Lock()
			cache[q] = a
			cacheMu.Unlock()
			log.Printf("[OpenAI] %s → %s", q, a)
			_ = json.NewEncoder(w).Encode(map[string]string{"a": a})
			return
		} else if err != nil {
			log.Printf("[OpenAI ERROR] %v", err)
		}
	}

	// 3. Fallback local
	ans := localAnswer(q)
	cacheMu.Lock()
	cache[q] = ans
	cacheMu.Unlock()
	log.Printf("[Local] %s → %s", q, ans)
	_ = json.NewEncoder(w).Encode(map[string]string{"a": ans})
}

func askOpenAI(apiKey, userQ string) (string, error) {
	body := map[string]any{
		"model": "gpt-4o-mini",
		"messages": []map[string]string{
			{"role": "system", "content": "You are an AI portfolio assistant for Sai Teja Bandamidi. Be concise, accurate, and grounded in his profile unless the user asks for general knowledge."},
			{"role": "system", "content": fmt.Sprintf("PROFILE: %+v", profile)},
			{"role": "user", "content": userQ},
		},
		"temperature": 0.3,
	}
	b, _ := json.Marshal(body)

	req, _ := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", bytes.NewReader(b))
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 18 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	if res.StatusCode/100 != 2 {
		io.Copy(io.Discard, res.Body)
		return "", fmt.Errorf("openai status %d", res.StatusCode)
	}

	var out struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		return "", err
	}
	if len(out.Choices) == 0 {
		return "", fmt.Errorf("no choices")
	}
	return strings.TrimSpace(out.Choices[0].Message.Content), nil
}

// ---------------------------- Local Fallback ---------------------------------

func localAnswer(q string) string {
	lq := strings.ToLower(q)
	for _, s := range profile.Skills {
		if strings.Contains(lq, strings.ToLower(s)) {
			return fmt.Sprintf("I have hands-on experience with %s in my projects.", s)
		}
	}
	for _, pr := range profile.Projects {
		if strings.Contains(lq, strings.ToLower(pr.Title)) {
			return fmt.Sprintf("%s — %s. Repo: %s", pr.Title, pr.Desc, pr.URL)
		}
	}
	if strings.Contains(lq, "who are you") {
		return fmt.Sprintf("I'm %s, %s, based in %s.", profile.Name, profile.Role, profile.Location)
	}
	return "I can answer questions about my skills (Go, GraphQL, SQLC, etc.), my projects, and how I use them."
}

// ------------------------------ Telemetry SSE --------------------------------

func sseHandler(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	for {
		data := map[string]any{
			"time":   time.Now().Format("15:04:05"),
			"temp":   fmt.Sprintf("%.1f", 20+rand.Float64()*10),
			"signal": fmt.Sprintf("%.0f", 70+rand.Float64()*30),
			"nodes":  (3 + rand.Intn(5)),
		}
		b, _ := json.Marshal(data)
		fmt.Fprintf(w, "data: %s\n\n", b)
		flusher.Flush()
		time.Sleep(2 * time.Second)
	}
}

// ---------------------------- Security Headers -------------------------------

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Content-Security-Policy",
			"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; media-src 'self';")
		next.ServeHTTP(w, r)
	})
}
