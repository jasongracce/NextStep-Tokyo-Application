# NextStep Tokyo Application

A minimal information and team registration website for NextStep Tokyo.

The page includes an animated welcome, three sections, a rotating navigation ring, and scroll progress indicators. Section 2 describes the organizational leader, Marketing team, and Event team. Section 3 currently contains a placeholder for the application form.

## Run locally

From the project directory, run:

```sh
python -m http.server 3000 --bind 127.0.0.1 --directory dist
```

Open http://localhost:3000.

The website uses plain HTML, CSS, and JavaScript. No dependency installation or build step is required. The website source is in `dist/index.html`.
