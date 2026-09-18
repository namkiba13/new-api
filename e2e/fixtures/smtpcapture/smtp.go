// Package smtpcapture receives real SMTP messages on loopback for isolated LABs.
package smtpcapture

import (
	"bufio"
	"fmt"
	"io"
	"mime"
	"net"
	"net/mail"
	"net/textproto"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

type Message struct {
	To      string `json:"to"`
	Subject string `json:"subject"`
	HTML    string `json:"html"`
}

type Server struct {
	listener   net.Listener
	mu         sync.Mutex
	messages   []Message
	Received   chan Message
	Host       string
	Port       int
	rejectNext atomic.Bool
}

func Start() (*Server, error) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, err
	}
	host, port, _ := net.SplitHostPort(listener.Addr().String())
	number, _ := strconv.Atoi(port)
	s := &Server{listener: listener, Host: host, Port: number, Received: make(chan Message, 1024)}
	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				return
			}
			go s.receive(conn)
		}
	}()
	return s, nil
}

func (s *Server) Close() error { return s.listener.Close() }

func (s *Server) RejectNextMessage() { s.rejectNext.Store(true) }

func (s *Server) Messages() []Message {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]Message{}, s.messages...)
}

// ponytail: loopback, unauthenticated SMTP only; TLS/auth are covered by common/email_test.go.
func (s *Server) receive(conn net.Conn) {
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(10 * time.Second))
	reader := textproto.NewReader(bufio.NewReader(conn))
	_, _ = fmt.Fprint(conn, "220 localhost SMTP LAB\r\n")
	for {
		line, err := reader.ReadLine()
		if err != nil {
			return
		}
		command := strings.ToUpper(strings.SplitN(line, " ", 2)[0])
		switch command {
		case "MAIL":
			if s.rejectNext.Swap(false) {
				_, _ = fmt.Fprint(conn, "451 Temporary SMTP LAB failure\r\n")
			} else {
				_, _ = fmt.Fprint(conn, "250 OK\r\n")
			}
		case "EHLO", "HELO", "RCPT", "RSET", "NOOP":
			_, _ = fmt.Fprint(conn, "250 OK\r\n")
		case "DATA":
			_, _ = fmt.Fprint(conn, "354 End with dot\r\n")
			raw, err := reader.ReadDotBytes()
			if err != nil {
				return
			}
			parsed, err := mail.ReadMessage(strings.NewReader(string(raw)))
			if err != nil {
				return
			}
			subject, err := new(mime.WordDecoder).DecodeHeader(parsed.Header.Get("Subject"))
			if err != nil {
				return
			}
			body, err := io.ReadAll(parsed.Body)
			if err != nil {
				return
			}
			message := Message{To: parsed.Header.Get("To"), Subject: subject, HTML: string(body)}
			s.mu.Lock()
			s.messages = append(s.messages, message)
			s.mu.Unlock()
			s.Received <- message
			_, _ = fmt.Fprint(conn, "250 Accepted\r\n")
		case "QUIT":
			_, _ = fmt.Fprint(conn, "221 Bye\r\n")
			return
		default:
			_, _ = fmt.Fprint(conn, "502 Unsupported\r\n")
		}
	}
}
