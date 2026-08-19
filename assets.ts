// Web app files embedded into the compiled binary so `nocturne --web`
// works even when the repo is gone.

import indexHtml from "./web/index.html" with { type: "text" };
import styleCss from "./web/style.css" with { type: "text" };
import appJs from "./web/app.js" with { type: "text" };
import onsetsJs from "./web/onsets.js" with { type: "text" };

export const WEB_FILES: Record<string, { body: string; type: string }> = {
  // bun-types calls an .html import HTMLBundle, but with { type: "text" } it is a string
  "/index.html": { body: indexHtml as unknown as string, type: "text/html; charset=utf-8" },
  "/style.css": { body: styleCss, type: "text/css" },
  "/app.js": { body: appJs, type: "text/javascript" },
  "/onsets.js": { body: onsetsJs, type: "text/javascript" },
};
