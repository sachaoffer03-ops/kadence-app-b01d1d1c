import { createFileRoute } from "@tanstack/react-router";

const BODY = {
  applinks: {
    apps: [],
    details: [
      {
        appID: "PLACEHOLDER_TEAMID.be.kadence.app",
        paths: ["*"],
      },
    ],
  },
  webcredentials: {
    apps: ["PLACEHOLDER_TEAMID.be.kadence.app"],
  },
};

export const Route = createFileRoute("/.well-known/apple-app-site-association")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify(BODY), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=3600",
          },
        }),
    },
  },
});
