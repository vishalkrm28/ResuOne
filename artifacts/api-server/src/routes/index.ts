import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import applicationsRouter from "./applications.js";
import uploadRouter from "./upload.js";
import exportRouter from "./export.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(applicationsRouter);
router.use(uploadRouter);
router.use(exportRouter);

export default router;
