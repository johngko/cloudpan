package handler

import (
	"os"
	"strings"
	"testing"
)

func TestExtractReadableFixture(t *testing.T) {
	for _, f := range strings.Fields(os.Getenv("FIXTURES")) {
		b, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		d := extractReadable(b)
		t.Logf("%s title=%q textRunes=%d head=%q", f, d.Title, runeLen(d.Text), clipRunes(d.Text, 160))
	}
}
