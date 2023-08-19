import {
  Application,
  isHttpError,
  Status,
} from "https://deno.land/x/oak@v12.6.0/mod.ts";

import {
  oakAdapter,
  handlebarsEngine,
  viewEngine,
} from "https://deno.land/x/view_engine@v10.6.0/mod.ts";

import { parse } from "https://deno.land/std@0.197.0/flags/mod.ts";
import { fileExists } from "./server/fileExists.ts";
// import { readKeypress } from "https://deno.land/x/keypress@0.0.11/mod.ts";

const app = new Application();
// const controller = new AbortController();

const static_folder = `${Deno.cwd()}/static`,
  flags = parse(Deno.args, {
    string: ["port", "http_port"],
    boolean: ["secure"],
    default: { secure: false },
  }),
  port = parseInt(flags.port ?? "") || 8000,
  http_port = parseInt(flags.http_port ?? "") || 8001;

// error handler
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    if (isHttpError(err))
      // deno-lint-ignore no-explicit-any
      (ctx as any).render("error.html", {
        type: Status[err.status],
        status: err.status,
      });
    else console.error(err);
  }
});

// logger
app.use(async (ctx, next) => {
  await next();
  const rt = ctx.response.headers.get("X-Response-Time");
  console.log(`${ctx.request.method} ${ctx.request.url} - ${rt}`);
});

// timing
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  ctx.response.headers.set("X-Response-Time", `${ms}ms`);
});

// template render
app.use(
  viewEngine(oakAdapter, handlebarsEngine, {
    viewRoot: static_folder,
  })
);

// static
app.use(async (ctx) => {
  let path = ctx.request.url.pathname;
  if (path !== "/" && !fileExists(`${static_folder}/${path}`))
    if (fileExists(`${static_folder}/${path}.html`)) path += ".html";
    else if (fileExists(`${static_folder}/${path}/index.html`)) {
      if (!path.endsWith("/")) {
        ctx.response.redirect(path + "/");
        return;
      } else path += "/index.html";
    }

  await ctx.send({
    root: static_folder,
    index: "index.html",
    path,
  });
});

// http redirect
if (flags.secure)
  new Application()
    .use((ctx) => {
      const url = ctx.request.url;
      url.protocol = "https:";
      url.port = `${port}`;
      console.log(`redirect to: ${url}`);
      ctx.response.redirect(url);
    })
    .listen({
      // signal: controller.signal,
      port: http_port,
    });

app.addEventListener("listen", ({ hostname, port, secure }) =>
  console.log(
    "Listening on: %s://%s:%s",
    secure ? "https" : "http",
    hostname ?? "localhost",
    port
  )
);

app.addEventListener("close", () => console.log("\nServer closed"));

app.listen({
  // signal: controller.signal,
  port,
  ...(flags.secure
    ? {
        secure: true,
        certFile: `${Deno.cwd()}/cert/fullchain.pem`,
        keyFile: `${Deno.cwd()}/cert/privkey.pem`,
      }
    : {}),
});

// const textEncoder = new TextEncoder();
// for await (const { key, sequence } of readKeypress()) {
//   if (key === "q" || key === "Q") {
//     controller.abort();
//     Deno.exit(0);
//   }
//   Deno.stdout.writeSync(textEncoder.encode(sequence));
// }
