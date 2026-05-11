// Tiny hash router. Routes register a (params) => Promise<void> handler that
// renders into #app. Navigation: route("#/practice") or set location.hash.

const routes = [];

export function on(pattern, handler) {
  // pattern is a string with optional :param placeholders. Strip the leading
  // "#" so the parts array matches what parseHash() produces from a URL.
  const trimmed = pattern.startsWith("#") ? pattern.slice(1) : pattern;
  const parts = trimmed.split("/");
  routes.push({ parts, handler });
}

function parseHash() {
  let h = location.hash || "#/";
  if (!h.startsWith("#")) h = "#" + h;
  const [pathPart, queryPart = ""] = h.slice(1).split("?");
  const parts = pathPart.split("/");
  const query = {};
  if (queryPart) {
    for (const kv of queryPart.split("&")) {
      const [k, v] = kv.split("=");
      query[decodeURIComponent(k)] = decodeURIComponent(v || "");
    }
  }
  return { parts, query };
}

function match(routeParts, urlParts) {
  if (routeParts.length !== urlParts.length) return null;
  const params = {};
  for (let i = 0; i < routeParts.length; i++) {
    if (routeParts[i].startsWith(":")) {
      params[routeParts[i].slice(1)] = decodeURIComponent(urlParts[i]);
    } else if (routeParts[i] !== urlParts[i]) {
      return null;
    }
  }
  return params;
}

export async function dispatch() {
  const { parts, query } = parseHash();
  for (const r of routes) {
    const params = match(r.parts, parts);
    if (params) {
      try {
        await r.handler({ ...params, ...query });
      } catch (e) {
        console.error(e);
        document.getElementById("app").innerHTML = `<div class="error">渲染出错: ${e.message}</div>`;
      }
      return;
    }
  }
  // Default route
  location.hash = "#/";
}

export function go(hash) {
  if (location.hash === hash) dispatch();
  else location.hash = hash;
}

window.addEventListener("hashchange", dispatch);
