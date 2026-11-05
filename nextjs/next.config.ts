import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDF-Schriften (public/fonts) auch in den API-Routen verfuegbar machen,
  // die Arbeitsvertraege ausfuellen.
  outputFileTracingIncludes: {
    "/api/vertrag/**": ["./public/fonts/**"],
  },
};

export default nextConfig;
