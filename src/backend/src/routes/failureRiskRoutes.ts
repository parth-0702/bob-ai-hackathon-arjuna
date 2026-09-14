import { Router } from "express";
import { getPredictionsForAssets, getPredictionForAsset } from "../services/failureRiskService.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const data = await getPredictionsForAssets();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:assetId", async (req, res) => {
  try {
    const data = await getPredictionForAsset(req.params.assetId);
    res.json(data);
  } catch (error: any) {
    if (error.message.includes("not found")) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

export default router;
