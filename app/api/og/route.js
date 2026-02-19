import { ImageResponse } from "next/og";
import { getDebateSSR } from "@/lib/queries/getDebateSSR";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const debateId = searchParams.get("debateId");

  if (!debateId) {
    return new Response("Missing debateId", { status: 400 });
  }

  const debate = await getDebateSSR(debateId);

  if (!debate) {
    return new Response("Debate not found", { status: 404 });
  }

  const topicTitle =
    debate.topics?.title || debate.topic_title || "Quick Match";
  const category = debate.topics?.category || debate.category || null;
  const proName = debate.pro_username || "Pro";
  const conName = debate.con_username || "Con";
  const proRank = debate.pro_rank_tier || null;
  const conRank = debate.con_rank_tier || null;
  const isCompleted =
    debate.status === "completed" || debate.status === "forfeited";
  const isLive = debate.status === "in_progress";
  const proScore = isCompleted
    ? parseFloat(debate.pro_quality_score || 0).toFixed(1)
    : null;
  const conScore = isCompleted
    ? parseFloat(debate.con_quality_score || 0).toFixed(1)
    : null;
  const winner = debate.winner || null;
  const winnerName =
    winner === "pro" ? proName : winner === "con" ? conName : null;

  // Cache headers: longer for completed debates
  const cacheControl = isCompleted
    ? "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400"
    : "public, max-age=0, s-maxage=0, no-cache";

  const image = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: "#FAF8F5",
          padding: "48px 56px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Header row: branding + category badge */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              fontSize: "26px",
              fontWeight: "800",
              color: "#FF6B35",
              letterSpacing: "-0.5px",
            }}
          >
            Arena.gg
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {isLive && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  backgroundColor: "#22c55e20",
                  border: "1px solid #22c55e50",
                  borderRadius: "20px",
                  padding: "6px 14px",
                }}
              >
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: "#22c55e",
                  }}
                />
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: "700",
                    color: "#22c55e",
                    letterSpacing: "0.08em",
                  }}
                >
                  LIVE
                </span>
              </div>
            )}
            {category && (
              <div
                style={{
                  backgroundColor: "#FF6B3515",
                  border: "1px solid #FF6B3530",
                  borderRadius: "20px",
                  padding: "6px 16px",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#FF6B35",
                }}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </div>
            )}
          </div>
        </div>

        {/* Topic title */}
        <div
          style={{
            fontSize: "13px",
            fontWeight: "600",
            color: "#6B7280",
            letterSpacing: "0.08em",
            marginBottom: "10px",
          }}
        >
          TOPIC
        </div>
        <div
          style={{
            fontSize: topicTitle.length > 60 ? "32px" : "40px",
            fontWeight: "700",
            color: "#1A1A1A",
            lineHeight: "1.2",
            marginBottom: "36px",
            flex: 1,
          }}
        >
          {topicTitle}
        </div>

        {/* Pro vs Con cards */}
        <div style={{ display: "flex", gap: "16px", alignItems: "stretch" }}>
          {/* Pro card */}
          <div
            style={{
              flex: 1,
              backgroundColor: "#FFFFFF",
              border: `1px solid ${winner === "pro" ? "#22c55e" : "#E8DDD0"}`,
              borderRadius: "16px",
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              position: "relative",
            }}
          >
            {winner === "pro" && (
              <div
                style={{
                  position: "absolute",
                  top: "-12px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  backgroundColor: "#22c55e",
                  color: "#fff",
                  fontSize: "11px",
                  fontWeight: "700",
                  padding: "3px 10px",
                  borderRadius: "10px",
                  letterSpacing: "0.05em",
                }}
              >
                WINNER
              </div>
            )}
            <div
              style={{
                fontSize: "11px",
                fontWeight: "700",
                color: "#22c55e",
                letterSpacing: "0.1em",
              }}
            >
              PRO
            </div>
            <div
              style={{
                fontSize: "22px",
                fontWeight: "700",
                color: "#1A1A1A",
              }}
            >
              {proName}
            </div>
            {proRank && (
              <div style={{ fontSize: "13px", color: "#9CA3AF" }}>{proRank}</div>
            )}
            {proScore && (
              <div
                style={{
                  fontSize: "36px",
                  fontWeight: "800",
                  color: "#22c55e",
                  marginTop: "4px",
                }}
              >
                {proScore}
              </div>
            )}
          </div>

          {/* VS divider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: "20px",
              fontWeight: "700",
              color: "#9CA3AF",
              padding: "0 4px",
            }}
          >
            VS
          </div>

          {/* Con card */}
          <div
            style={{
              flex: 1,
              backgroundColor: "#FFFFFF",
              border: `1px solid ${winner === "con" ? "#ef4444" : "#E8DDD0"}`,
              borderRadius: "16px",
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              position: "relative",
            }}
          >
            {winner === "con" && (
              <div
                style={{
                  position: "absolute",
                  top: "-12px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  backgroundColor: "#ef4444",
                  color: "#fff",
                  fontSize: "11px",
                  fontWeight: "700",
                  padding: "3px 10px",
                  borderRadius: "10px",
                  letterSpacing: "0.05em",
                }}
              >
                WINNER
              </div>
            )}
            <div
              style={{
                fontSize: "11px",
                fontWeight: "700",
                color: "#ef4444",
                letterSpacing: "0.1em",
              }}
            >
              CON
            </div>
            <div
              style={{
                fontSize: "22px",
                fontWeight: "700",
                color: "#1A1A1A",
              }}
            >
              {conName}
            </div>
            {conRank && (
              <div style={{ fontSize: "13px", color: "#9CA3AF" }}>{conRank}</div>
            )}
            {conScore && (
              <div
                style={{
                  fontSize: "36px",
                  fontWeight: "800",
                  color: "#ef4444",
                  marginTop: "4px",
                }}
              >
                {conScore}
              </div>
            )}
          </div>
        </div>

        {/* Draw banner */}
        {winner === "draw" && (
          <div
            style={{
              marginTop: "20px",
              backgroundColor: "#FF6B3515",
              border: "1px solid #FF6B3530",
              borderRadius: "12px",
              padding: "12px 24px",
              textAlign: "center",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: "16px",
                fontWeight: "700",
                color: "#FF6B35",
              }}
            >
              Draw — Both debaters performed equally
            </span>
          </div>
        )}
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": cacheControl,
      },
    }
  );

  return image;
}
