import express from "express";
import cors from "cors";
import { categorizeRouter } from "./routes/categorize.js";
import { scanRouter } from "./routes/scan.js";
import { dealsRouter } from "./routes/deals.js";
import { organizeByAisleRouter } from "./routes/organizeByAisle.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use("/api", categorizeRouter);
app.use("/api", scanRouter);
app.use("/api", dealsRouter);
app.use("/api", organizeByAisleRouter);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`ShoppingListAssist backend running on http://localhost:${PORT}`);
});
