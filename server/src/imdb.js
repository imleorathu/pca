import {
  DataExchangeClient,
  SendApiAssetCommand,
} from "@aws-sdk/client-dataexchange";

const required = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "IMDB_API_KEY",
  "IMDB_DATASET_ID",
  "IMDB_REVISION_ID",
  "IMDB_ASSET_ID",
];
export const imdbConfigured = () =>
  required.every((key) => Boolean(process.env[key]));

async function graphql(query) {
  if (!imdbConfigured()) {
    const error = new Error(
      "IMDb API is not configured. Add the AWS Data Exchange and IMDb credentials to server/.env.",
    );
    error.status = 503;
    throw error;
  }
  const client = new DataExchangeClient({
    region: process.env.AWS_REGION || "us-east-1",
  });
  const response = await client.send(
    new SendApiAssetCommand({
      AssetId: process.env.IMDB_ASSET_ID,
      DataSetId: process.env.IMDB_DATASET_ID,
      RevisionId: process.env.IMDB_REVISION_ID,
      Method: "POST",
      Path: "/",
      RequestHeaders: {
        "content-type": "application/json",
        "x-api-key": process.env.IMDB_API_KEY,
      },
      Body: JSON.stringify({ query }),
    }),
  );
  const body =
    typeof response.Body === "string"
      ? response.Body
      : new TextDecoder().decode(response.Body);
  const result = JSON.parse(body || "{}");
  if (result.errors?.length)
    throw new Error(result.errors.map((item) => item.message).join("; "));
  return result.data;
}

const safe = (value) =>
  String(value || "")
    .replace(/["\\\n\r]/g, " ")
    .trim();
export async function searchImdb(term) {
  const data = await graphql(
    `query { mainSearch(first: 10 options: { searchTerm: "${safe(term)}" isExactMatch: false type: TITLE titleSearchOptions: { type: MOVIE } }) { edges { node { entity { ... on Title { id titleText { text } releaseYear { year } ratingsSummary { aggregateRating voteCount } } } } } } }`,
  );
  return (data?.mainSearch?.edges || [])
    .map(({ node }) => node.entity)
    .filter(Boolean);
}
export async function getImdbTitle(id) {
  const data = await graphql(
    `query { title(id: "${safe(id)}") { id titleText { text } ratingsSummary { aggregateRating voteCount } titleGenres { genres { genre { text } } } plots(first: 1) { edges { node { plotText { plainText } } } } certificate { rating } runtime { seconds } releaseDate { day month year } } }`,
  );
  const item = data?.title;
  if (!item) return null;
  const seconds = item.runtime?.seconds || 0;
  return {
    imdbId: item.id,
    id: item.id,
    title: item.titleText?.text || "",
    synopsis: item.plots?.edges?.[0]?.node?.plotText?.plainText || "",
    genre: (item.titleGenres?.genres || [])
      .map((x) => x.genre?.text)
      .filter(Boolean)
      .join(", "),
    rating: item.ratingsSummary?.aggregateRating
      ? String(item.ratingsSummary.aggregateRating)
      : "",
    certificate: item.certificate?.rating || "",
    runtime: seconds
      ? `${Math.floor(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`
      : "",
    releaseDate: item.releaseDate
      ? `${item.releaseDate.year}-${String(item.releaseDate.month || 1).padStart(2, "0")}-${String(item.releaseDate.day || 1).padStart(2, "0")}`
      : "",
  };
}
