const SOCIAL_PREVIEW_USER_AGENT =
  /telegrambot|twitterbot|facebookexternalhit|facebot|meta-externalagent|meta-webindexer|whatsapp|linkedinbot|slackbot|pinterest|redditbot|skypeuripreview|viber|googlebot|google-inspectiontool|bingbot|applebot|embedly|iframely|mastodon|cardyb/i;

export function isSocialPreviewUserAgent(userAgent: string | null): boolean {
  return userAgent !== null && SOCIAL_PREVIEW_USER_AGENT.test(userAgent);
}
