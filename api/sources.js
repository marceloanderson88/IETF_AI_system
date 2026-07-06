export default async function handler(_request, response) {
  try {
    const upstream = await fetch("https://datatracker.ietf.org/api/v1/group/group/?state__slug=active&limit=12");
    const data = await upstream.json();
    response.status(200).json({ source: "datatracker", ok: true, data: data.objects || [] });
  } catch (error) {
    response.status(200).json({ source: "datatracker", ok: false, error: String(error) });
  }
}
