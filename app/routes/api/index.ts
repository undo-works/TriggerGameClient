import { LoaderFunction } from "@remix-run/node";

export const loader: LoaderFunction = async () => {
  const apiDescriptions = {
    "/api/negotiate": {
      description: "Web PUBSUBの認証を行い、クライアント接続用のURLを発行する",
      method: "POST",
      response: { users: [{ id: 1, name: "Taro" }] }
    },
  };

  return new Response(JSON.stringify(apiDescriptions), {
    headers: { "Content-Type": "application/json" }
  });
};