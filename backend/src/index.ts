import express from "express";
import cors from "cors";
import { categorizeRouter } from "./routes/categorize.js";
import { layoutRouter } from "./routes/layout.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.use("/api", categorizeRouter);
app.use("/api", layoutRouter);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`AisleIQ backend running on http://localhost:${PORT}`);
});
