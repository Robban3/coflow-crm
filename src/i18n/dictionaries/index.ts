// Aggregates per-feature dictionaries. Each entry contributes translation keys
// for every supported language and is merged into the main `translations`
// object (see ../translations.ts). Add new feature dictionaries to this array.
import type { FeatureDictionary } from "../translations";

import { tasksDict } from "./tasks";
import { meetingsDict } from "./meetings";
import { quotesDict } from "./quotes";
import { ticketsDict } from "./tickets";
import { statisticsDict } from "./statistics";
import { reportsDict } from "./reports";
import { prospectingDict } from "./prospecting";
import { webAnalysisDict } from "./webAnalysis";
import { leadDetailDict } from "./leadDetail";
import { mailDict } from "./mail";
import { settingsDict } from "./settings";
import { onboardingDict } from "./onboarding";
import { outreachDict } from "./outreach";
import { powerCallDict } from "./powerCall";
import { offersDict } from "./offers";
import { publicPagesDict } from "./publicPages";
import { templatesDict } from "./templates";
import { aiDict } from "./ai";
import { trainingDict } from "./training";

export const featureDictionaries: FeatureDictionary[] = [
  tasksDict,
  meetingsDict,
  quotesDict,
  ticketsDict,
  statisticsDict,
  reportsDict,
  prospectingDict,
  webAnalysisDict,
  leadDetailDict,
  mailDict,
  settingsDict,
  onboardingDict,
  outreachDict,
  powerCallDict,
  offersDict,
  publicPagesDict,
  templatesDict,
  aiDict,
  trainingDict,
];
