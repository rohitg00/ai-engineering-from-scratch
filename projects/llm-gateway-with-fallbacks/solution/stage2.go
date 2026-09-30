package main

func ClassifyStatus(status int) (string, error) {
	if status < 100 || status > 599 {
		return "", ErrInvalid
	}
	if status >= 200 && status < 300 {
		return "success", nil
	}
	if status == 429 || status >= 500 {
		return "retry", nil
	}
	return "terminal", nil
}
