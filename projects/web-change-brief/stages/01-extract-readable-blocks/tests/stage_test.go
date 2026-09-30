package main

import (
	"reflect"
	"strings"
	"testing"
)

func TestBlocksNormalizeEntitiesAndWhitespace(t *testing.T) {
	got, err := ExtractBlocks("<p> Bring  tea &amp;\n biscuits. </p>", nil)
	if err != nil || !reflect.DeepEqual(got, []string{"Bring tea & biscuits."}) {
		t.Fatal(got, err)
	}
}
func TestNoiseRegionsDoNotLeak(t *testing.T) {
	got, err := ExtractBlocks("<head><title>Ignore</title></head><nav>Counter</nav><p>Visible</p><script>run()</script><style>p{}</style><footer>Today</footer>", nil)
	if err != nil || !reflect.DeepEqual(got, []string{"Visible"}) {
		t.Fatal(got, err)
	}
}
func TestQuotedTagDelimiterAndInlineTags(t *testing.T) {
	got, err := ExtractBlocks(`<p title="a > b">A <strong>small</strong> repair</p>`, nil)
	if err != nil || !reflect.DeepEqual(got, []string{"A small repair"}) {
		t.Fatal(got, err)
	}
}
func TestIgnorePhrasesRemoveWholeMatchingBlock(t *testing.T) {
	got, err := ExtractBlocks("<p>Updated today: 44</p><p>Open Thursday</p>", []string{"UPDATED TODAY", ""})
	if err != nil || !reflect.DeepEqual(got, []string{"Open Thursday"}) {
		t.Fatal(got, err)
	}
}
func TestMalformedAndOversizeHTMLFails(t *testing.T) {
	for _, input := range []string{"<p", "<!--missing", "<nav>missing", strings.Repeat("a", MaxHTMLBytes+1), "<>"} {
		if _, err := ExtractBlocks(input, nil); err == nil {
			t.Errorf("accepted malformed input of length %d", len(input))
		}
	}
}
func TestEmptyAndCommentsProduceNoInventedText(t *testing.T) {
	got, err := ExtractBlocks("<!--comment--><p> </p>", nil)
	if err != nil || len(got) != 0 {
		t.Fatal(got, err)
	}
}
func TestSeparateRepeatedBlocksRemainRepeated(t *testing.T) {
	got, err := ExtractBlocks("<p>Repeat</p><p>Repeat</p>", nil)
	if err != nil || !reflect.DeepEqual(got, []string{"Repeat", "Repeat"}) {
		t.Fatal(got, err)
	}
}
