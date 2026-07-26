import { createFileRoute } from "@tanstack/react-router";

const BODY = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "be.kadence.app",
      sha256_cert_fingerprints: ["PLACEHOLDER_SHA256_A_REMPLACER"],
    },
  },
];

export const Route = createFileRoute("/.well-known/assetlinks.json")({
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
