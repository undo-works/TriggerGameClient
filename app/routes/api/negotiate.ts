import { ActionFunctionArgs } from "@remix-run/node";
import { WebPubSubServiceClient } from "@azure/web-pubsub";
import { corsHeaders } from "./utils/header";

/**
 * Web Pubsubの認証を行い、クライアント接続用のURLを発行するリクエスト
 * @param {string} userId - ユーザーID
 */
export interface NegotiateRequest {
  /** ユーザーID */
  userId: string;
}

/**
 * Web Pubsubの認証を行い、クライアント接続用のURLを発行するレスポンス
 * @param {string} url - WebSocket接続用のURL
 * @param {string} userId - ユーザーID
 */
export interface NegotiateResponse {
  url: string;
  userId: string;
}

export interface NegotiateError {
  error: string;
  details?: string;
}

/**
 * Web Pubsubの認証を行い、クライアント接続用のURLを発行する
 * @param {ActionFunctionArgs} request
 * @returns 
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    if (process.env.NODE_ENV === "development") {
      return Response.json(
        {
          url: "ws://localhost:8080",
          userId: `dev_user_${Date.now()}`
        },
        {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Content-Type": "application/json",
          },
        }
      );
    }
    const connectionString = process.env.WEB_PUBSUB_CONNECTION_STRING;
    if (!connectionString) {
      return Response.json(
        { error: "Web PubSub connection string not configured" },
        {
          status: 500,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        }
      );
    }

    const serviceClient = new WebPubSubServiceClient(connectionString, "gameHub");

    let body: NegotiateRequest | null = null;
    if (request.method === "POST") {
      try {
        const text = await request.text();
        if (text) {
          body = JSON.parse(text) as NegotiateRequest;
        }
      } catch {
        // ignore invalid body
      }
    }

    const userId = body?.userId;
    const token = await serviceClient.getClientAccessToken({
      userId,
      expirationTimeInMinutes: 60,
      roles: ["webpubsub.sendToGroup", "webpubsub.joinLeaveGroup"],
    });

    return Response.json(
      { url: token.url, userId: userId },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Negotiate error:", error);
    const errorMessage = (error instanceof Error) ? error.message : String(error);
    return Response.json(
      { error: "Failed to negotiate connection", details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * CORS対応のOPTIONSリクエスト
 * @returns {Promise<Response>} 
 */
export async function loader(): Promise<Response> {
  return new Response(null, { status: 200, headers: corsHeaders });
}