import { ImageResponse } from "next/og";
import { getProfileSSR } from "@/lib/queries/getProfileSSR";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return new Response("Missing userId", { status: 400 });
  }

  const profile = await getProfileSSR(userId);

  if (!profile) {
    return new Response("Profile not found", { status: 404 });
  }

  const username = profile.username || "Debater";
  const rankTier = profile.rank_tier || "Bronze";
  const wins = profile.wins || 0;
  const losses = profile.losses || 0;
  const draws = profile.draws || 0;
  const totalDebates = profile.total_debates || 0;
  const qualityScore = parseFloat(
    profile.quality_score_avg || profile.quality_score || 50
  ).toFixed(1);

  // Rank tier color mapping
  const rankColors = {
    Bronze: "#cd7f32",
    Silver: "#9ca3af",
    Gold: "#f59e0b",
    Platinum: "#67e8f9",
    Diamond: "#818cf8",
  };
  const rankColor = rankColors[rankTier] || "#6366f1";

  const image = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: "#0d0d0f",
          padding: "56px 64px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "48px",
          }}
        >
          <div
            style={{
              fontSize: "24px",
              fontWeight: "800",
              color: "#6366f1",
            }}
          >
            Arena.gg
          </div>
          <div
            style={{
              backgroundColor: rankColor + "20",
              border: `1px solid ${rankColor}50`,
              borderRadius: "20px",
              padding: "6px 18px",
              fontSize: "14px",
              fontWeight: "700",
              color: rankColor,
            }}
          >
            {rankTier}
          </div>
        </div>

        {/* Avatar + username */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "28px",
            marginBottom: "48px",
          }}
        >
          <div
            style={{
              width: "96px",
              height: "96px",
              borderRadius: "50%",
              backgroundColor: "#6366f120",
              border: "2px solid #6366f140",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "40px",
              fontWeight: "800",
              color: "#6366f1",
            }}
          >
            {username[0].toUpperCase()}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div
              style={{
                fontSize: "14px",
                color: "#6b7280",
                fontWeight: "500",
              }}
            >
              @{username}
            </div>
            <div
              style={{
                fontSize: "42px",
                fontWeight: "800",
                color: "#f0f0f5",
                lineHeight: "1",
              }}
            >
              {username}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: "20px", flex: 1 }}>
          {[
            { label: "Debates", value: totalDebates, color: "#f0f0f5" },
            { label: "Wins", value: wins, color: "#22c55e" },
            { label: "Losses", value: losses, color: "#ef4444" },
            { label: "Draws", value: draws, color: "#9ca3af" },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                flex: 1,
                backgroundColor: "#1a1a1f",
                border: "1px solid #2a2a35",
                borderRadius: "16px",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <div
                style={{
                  fontSize: "36px",
                  fontWeight: "800",
                  color: stat.color,
                }}
              >
                {stat.value}
              </div>
              <div style={{ fontSize: "13px", color: "#6b7280", fontWeight: "500" }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Quality score bar */}
        <div
          style={{
            marginTop: "24px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div style={{ fontSize: "14px", color: "#6b7280", fontWeight: "500", minWidth: "120px" }}>
            Quality Score
          </div>
          <div
            style={{
              flex: 1,
              height: "10px",
              backgroundColor: "#1a1a1f",
              borderRadius: "5px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${qualityScore}%`,
                height: "100%",
                backgroundColor: "#6366f1",
                borderRadius: "5px",
              }}
            />
          </div>
          <div
            style={{
              fontSize: "20px",
              fontWeight: "700",
              color: "#6366f1",
              minWidth: "48px",
              textAlign: "right",
            }}
          >
            {qualityScore}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  );

  return image;
}
