import { MessageTypes, sendWebhookMessage } from "../utils/webhook_client";

export function logError(err, req, res, next) {
  console.error(`An API error occurred: ${req.method} ${req.path}\n`, err);
  next(err);
}

export async function reportError(err, req, res, next) {
  try {
    await sendWebhookMessage(
      MessageTypes.Error,
      "Error occurred in ncn-backend.",
      [
        { name: "Component", value: "Backend API endpoint" },
        { name: "Method", value: req.method },
        { name: "Path", value: req.path },
        {
          name: "Request Body",
          value: "```\n" + JSON.stringify(req.body) + "\n```",
        },
        { name: "Error Log", value: "```\n" + err.stack + "\n```" },
      ]
    );
    next(err);
  } catch (_err) {
    // cannot send webhook, console and keep going
    console.error(_err);
    next(err);
  }
}

export function errorResponse(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  res
    .status(500)
    .send({ message: "Internal server error", error: err.message });
}
