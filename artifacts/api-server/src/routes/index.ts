import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import applicationsRouter from "./applications.js";
import uploadRouter from "./upload.js";
import exportRouter from "./export.js";
import billingRouter from "./billing.js";
import bulkRouter from "./bulk.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(applicationsRouter);
router.use(uploadRouter);
router.use(exportRouter);
router.use(billingRouter);
router.use(bulkRouter);

export default router;
