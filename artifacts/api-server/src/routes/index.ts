import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import applicationsRouter from "./applications.js";
import uploadRouter from "./upload.js";
import exportRouter from "./export.js";
import billingRouter from "./billing.js";
import bulkRouter from "./bulk.js";
import contactRouter from "./contact.js";
import adminSeedRouter from "./admin-seed.js";
import recruiterRouter from "./recruiter.js";
import recruiterJobsRouter from "./recruiter-jobs.js";
import publicRouter from "./public.js";

const router: IRouter = Router();

router.use(publicRouter);
router.use(healthRouter);
router.use(authRouter);
router.use(applicationsRouter);
router.use(uploadRouter);
router.use(exportRouter);
router.use(billingRouter);
router.use(bulkRouter);
router.use(contactRouter);
router.use(adminSeedRouter);
router.use(recruiterRouter);
router.use(recruiterJobsRouter);

export default router;
