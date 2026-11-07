// GET /api/health — model + limits status. No key material is ever exposed;
// keyConfigured is a boolean only.

const MODEL = "google/gemma-4-31b-it";

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).setHeader("Content-Type", "application/json");
    return res.json({ error: "METHOD_NOT_ALLOWED", message: "Use GET." });
  }
  res.status(200).setHeader("Content-Type", "application/json");
  return res.json({
    status: "ok",
    version: "1.0.0-phase1",
    model: MODEL,
    keyConfigured: Boolean(process.env.NVIDIA_API_KEY),
    limits: {
      humanizeMaxChars: 5000,
      humanizePerHourPerIp: 10,
      detectMaxChars: 20000,
      detectPerMinutePerIp: 30,
    },
    notes: [
      "Detector scores on this site are local heuristic estimates, not ZeroGPT or Turnitin.",
      "No plagiarism percentage is shown: the local checker cannot run on serverless, and no fake number is ever shown.",
      "PDF upload arrives in Phase 2.",
    ],
  });
};
