// api-gateway/src/index.ts
import express from "express";
import dotenv from "dotenv";
import { json } from "body-parser";

dotenv.config();
const app = express();
app.use(json());

app.get("/health", (_req, res) => res.json({ status: "ok", service: "api-gateway" }));

// temporary placeholders
app.post("/register-webhook", (_req, res) => res.status(501).send("Not implemented"));
app.post("/send-event", (_req, res) => res.status(501).send("Not implemented"));

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`API Gateway listening on ${PORT}`));
