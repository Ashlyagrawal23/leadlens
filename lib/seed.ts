import { daysAgo, daysFromNow } from "@/lib/leads";
import type { Analysis, ContactLog, Lead } from "@/lib/types";

/**
 * Six handwritten leads so the dashboard is useful before any API key is set.
 *
 * Dates are computed at first load (not frozen in 2024) so "overdue" and
 * "due today" stay true on the day a reviewer opens the app. analyzedBy is
 * "seed": these analyses were not produced by Gemini.
 */

/** Gives the object a typed check against Analysis while the seed stays readable. */
function analysis(input: Analysis): Analysis {
  return input;
}

function log(id: string, channel: ContactLog["channel"], notes: string, days: number): ContactLog {
  return { id, channel, notes, contactedAt: daysAgo(days, 16) };
}

export function buildSeedLeads(): Lead[] {
  const priyaCreated = daysAgo(1, 9);
  const rahulCreated = daysAgo(2, 12);
  const ananyaCreated = daysAgo(6, 15);
  const vikramCreated = daysAgo(9, 11);
  const snehaCreated = daysAgo(12, 10);
  const arjunCreated = daysAgo(15, 18);

  const leads: Lead[] = [
    {
      id: "seed-priya",
      name: "Priya Sharma",
      location: "Gurgaon, DLF Phase 3",
      propertyRequirement: "Ready 3 BHK, high floor, one covered parking",
      budget: "₹2.4 Cr, HDFC loan sanctioned",
      timeline: "Immediate",
      message:
        "Hi, this is Priya. We are moving from Delhi to Gurgaon next month because my office shifted to Cyber Hub. Looking for a ready-to-move 3 BHK in DLF Phase 3 or Phase 2, high floor, covered parking for one car. Budget is firm at 2.4 crore and the home loan is already sanctioned by HDFC. Can we do a site visit this Saturday before noon? Please do not send under-construction options. Also, is the price inclusive of GST and parking?",
      status: "New",
      createdAt: priyaCreated,
      updatedAt: priyaCreated,
      lastContactedAt: null,
      followUpDueAt: daysAgo(1, 18),
      contactLogs: [],
      chat: [],
      analyzedBy: "seed",
      analysis: analysis({
        summary:
          "Priya is moving to Gurgaon next month and wants a ready 3 BHK in DLF Phase 2 or 3 with a sanctioned loan. She asked for a Saturday morning visit and a clear all-in price.",
        intent: "Ready to buy",
        keyRequirements: [
          "Ready-to-move 3 BHK",
          "DLF Phase 2 or Phase 3",
          "High floor and one covered parking",
          "Budget ₹2.4 Cr with HDFC loan sanctioned",
          "Site visit this Saturday before noon",
        ],
        objections: [
          "Wants the price to include GST and parking",
          "Will not consider under-construction homes",
        ],
        nextAction: "Call Priya today before 6pm and lock Saturday 10:30am, with the all-in price in hand.",
        suggestedResponse:
          "Hi Priya, thank you for the clear brief. I have a ready 3 BHK shortlist in DLF Phase 2 and Phase 3 only — no under-construction options. Your budget of ₹2.4 Cr and the sanctioned HDFC loan are noted. Can we lock Saturday at 10:30am? I will bring the all-in price, including GST and parking, so you can compare it on the spot.",
        score: 86,
        priority: "hot",
        urgencyFlag: true,
        urgencyReason: "She is moving next month and asked for a Saturday visit.",
        scoreReasoning: [
          "Budget is specific and the home loan is already sanctioned.",
          "Timeline is immediate and she requested a site visit.",
        ],
      }),
    },
    {
      id: "seed-rahul",
      name: "Rahul Mehta",
      location: "Noida, Sector 150",
      propertyRequirement: "3 BHK ready possession, park-facing if possible",
      budget: "₹1.75 Cr",
      timeline: "Immediate",
      message:
        "Hello, I visited your Sector 150 page. We need a 3 BHK ready flat, preferably park-facing, budget 1.75 crore. Loan is sanctioned. Saturday late morning works for a visit, but I need to confirm with my wife tonight. Please WhatsApp the exact tower and floor before we come. Not interested in anything possession after December.",
      status: "Contacted",
      createdAt: rahulCreated,
      updatedAt: daysAgo(1, 17),
      lastContactedAt: daysAgo(1, 17),
      followUpDueAt: daysAgo(0, 23),
      contactLogs: [
        log(
          "seed-log-rahul",
          "whatsapp",
          "Shared a Saturday 11:00 slot. He will confirm after speaking with his wife tonight.",
          1,
        ),
      ],
      chat: [],
      analyzedBy: "seed",
      analysis: analysis({
        summary:
          "Rahul wants a ready, preferably park-facing 3 BHK in Sector 150 within ₹1.75 Cr and can visit Saturday if his wife agrees. Possession after December is a no.",
        intent: "Ready to buy",
        keyRequirements: [
          "3 BHK ready possession in Sector 150",
          "Park-facing preferred",
          "Budget ₹1.75 Cr, loan sanctioned",
          "Possession by December",
          "Tower and floor on WhatsApp before the visit",
        ],
        objections: ["Needs his wife's confirmation before locking the visit"],
        nextAction: "WhatsApp Rahul today by 7pm with tower and floor, and ask him to confirm Saturday 11:00am.",
        suggestedResponse:
          "Hi Rahul, sharing the details before your visit: Tower B, 14th floor, park-facing 3 BHK in Sector 150, possession already done, asking ₹1.75 Cr. Saturday 11:00am is held for you. Once you have spoken with your wife, reply YES and I will send the location pin.",
        score: 81,
        priority: "hot",
        urgencyFlag: true,
        urgencyReason: "Visit depends on a confirmation tonight and possession is time-bound.",
        scoreReasoning: [
          "Loan, budget, configuration, and a visit window are all specific.",
          "The only open loop is his wife's confirmation, which is due tonight.",
        ],
      }),
    },
    {
      id: "seed-ananya",
      name: "Ananya Iyer",
      location: "Bangalore, Whitefield",
      propertyRequirement: "2 BHK near Hope Farm, ready or possession within 6 months",
      budget: "Around ₹95 lakhs",
      timeline: "1-3 months",
      message:
        "We are comparing a Prestige 2 BHK near Hope Farm with a Brigade option. Budget is about 95 lakhs all inclusive, and we would like to decide in the next two months. I liked the Prestige deck but the bedroom felt small. Can you arrange a Brigade visit this weekend? Please do not add club-house charges on top without telling me.",
      status: "Site Visit",
      createdAt: ananyaCreated,
      updatedAt: daysAgo(3, 18),
      lastContactedAt: daysAgo(3, 18),
      followUpDueAt: daysFromNow(2, 18),
      contactLogs: [
        log(
          "seed-log-ananya",
          "call",
          "Toured Prestige. She liked the deck and thought the bedroom was small. Wants a Brigade visit this weekend. Budget still about ₹95L all-in.",
          3,
        ),
      ],
      chat: [],
      analyzedBy: "seed",
      analysis: analysis({
        summary:
          "Ananya is choosing between Prestige and Brigade 2 BHKs in Whitefield and wants to decide within two months. She liked the Prestige deck, disliked the bedroom size, and asked for a Brigade visit.",
        intent: "Comparing options",
        keyRequirements: [
          "2 BHK near Hope Farm, Whitefield",
          "Ready or possession within 6 months",
          "All-inclusive budget around ₹95 lakhs",
          "Brigade visit this weekend",
        ],
        objections: [
          "Prestige bedroom felt small",
          "Does not want surprise club-house charges",
        ],
        nextAction: "Book the Brigade visit for this weekend and send a one-page all-in cost comparison against Prestige.",
        suggestedResponse:
          "Hi Ananya, I noted you liked the Prestige deck and found the bedroom tight. I can hold a Brigade 2 BHK visit this weekend near Hope Farm. I will send both options with an all-in figure around your ₹95 lakh budget, including any club charges, so nothing is added later.",
        score: 64,
        priority: "warm",
        urgencyFlag: false,
        urgencyReason: "She wants a weekend visit, but the buying decision is still one to two months out.",
        scoreReasoning: [
          "Budget and location are clear, and she has already done one site visit.",
          "She is still comparing two projects, so this is not a same-week close.",
        ],
      }),
    },
    {
      id: "seed-vikram",
      name: "Vikram Singh",
      location: "Mumbai, Andheri East",
      propertyRequirement: "1 BHK for rental income, near the metro",
      budget: "₹1.1–1.3 Cr",
      timeline: "3-6 months",
      message:
        "Looking at a 1 BHK in Andheri East purely as an investment. Budget 1.1 to 1.3 crore. I care about rental yield more than the view. A broker in Thane showed me something at a 4.5% yield. If you cannot get close to that, I will wait. Please email a written price breakdown and expected rent. No calls after 8pm.",
      status: "Negotiation",
      createdAt: vikramCreated,
      updatedAt: daysAgo(4, 19),
      lastContactedAt: daysAgo(4, 19),
      followUpDueAt: daysFromNow(4, 18),
      contactLogs: [
        log(
          "seed-log-vikram",
          "email",
          "He is comparing yield with a Thane 1 BHK at 4.5%. Asked for a written price breakdown and expected rent. Do not call after 8pm.",
          4,
        ),
      ],
      chat: [],
      analyzedBy: "seed",
      analysis: analysis({
        summary:
          "Vikram is an investor comparing a 1 BHK in Andheri East at ₹1.1–1.3 Cr with a Thane option yielding 4.5%. He wants the price and rent in writing and will wait if the yield is weaker.",
        intent: "Investment",
        keyRequirements: [
          "1 BHK in Andheri East near the metro",
          "Purchase for rental income",
          "Budget ₹1.1–1.3 Cr",
          "Written price breakdown and expected rent",
        ],
        objections: [
          "Thane alternative is already at a 4.5% yield",
          "Will delay the purchase if yield is not close",
          "No calls after 8pm",
        ],
        nextAction: "Email a one-page yield comparison by tomorrow 11am, using only rent you can support.",
        suggestedResponse:
          "Hi Vikram, I will email a written breakdown for the Andheri East 1 BHK: price, extra charges, and a rent figure I can support, set next to your ₹1.1–1.3 Cr budget. I will not guess a yield. If it is not close to the 4.5% Thane option, I will say so plainly. I will also keep this on email, and I will not call after 8pm.",
        score: 52,
        priority: "warm",
        urgencyFlag: false,
        urgencyReason: "He asked for a written breakdown, but his timeline is 3–6 months and he is willing to wait.",
        scoreReasoning: [
          "Budget band and investment goal are specific.",
          "He is benchmarking another city and is comfortable delaying.",
        ],
      }),
    },
    {
      id: "seed-sneha",
      name: "Sneha Kapoor",
      location: "Pune, Hinjewadi",
      propertyRequirement: "Something nice, maybe a 3 BHK",
      budget: "Under ₹50 lakhs if possible",
      timeline: "6+ months",
      message:
        "Just looking for now. Maybe a 3 BHK somewhere nice in Hinjewadi. If something is under 50 lakhs do send it, otherwise I am not in a hurry. Will check back next year maybe.",
      status: "New",
      createdAt: snehaCreated,
      updatedAt: snehaCreated,
      lastContactedAt: null,
      followUpDueAt: daysAgo(6, 18),
      contactLogs: [],
      chat: [],
      analyzedBy: "seed",
      analysis: analysis({
        summary:
          "Sneha might want a 3 BHK in Hinjewadi but has no firm plan and said she may check back next year. A budget under ₹50 lakhs is stated, with no loan or visit request.",
        intent: "Just browsing",
        keyRequirements: ["Possible 3 BHK in Hinjewadi", "Budget under ₹50 lakhs if possible"],
        objections: ["Not in a hurry", "May not look again until next year"],
        nextAction: "Send one honest WhatsApp tomorrow morning: a 3 BHK in Hinjewadi is above ₹50 lakhs, and ask if a higher budget or a smaller home is acceptable.",
        suggestedResponse:
          "Hi Sneha, thanks for writing. A 3 BHK in Hinjewadi is not available under ₹50 lakhs in the projects I cover, so I do not want to send options that miss your budget. If a 2 BHK or a higher budget could work, tell me and I will send two real choices. If not, I will check back closer to next year as you mentioned.",
        score: 26,
        priority: "cold",
        urgencyFlag: false,
        urgencyReason: "No near-term deadline mentioned. She said she may look next year.",
        scoreReasoning: [
          "The budget is specific but unrealistic for a 3 BHK in Hinjewadi.",
          "The message has no visit, loan, or decision date.",
        ],
      }),
    },
    {
      id: "seed-arjun",
      name: "Arjun Reddy",
      location: "Hyderabad, Gachibowli",
      propertyRequirement: "Cheapest 2 or 3 BHK you have",
      budget: "Not mentioned",
      timeline: "Just exploring",
      message: "Send cheapest options in Gachibowli. 2 or 3 bhk. Price only.",
      status: "Contacted",
      createdAt: arjunCreated,
      updatedAt: daysAgo(8, 13),
      lastContactedAt: daysAgo(8, 13),
      followUpDueAt: daysFromNow(14, 18),
      contactLogs: [
        log(
          "seed-log-arjun",
          "whatsapp",
          "Asked only for the cheapest Gachibowli options. No budget and no timeline. Sent two links. No reply since.",
          8,
        ),
      ],
      chat: [],
      analyzedBy: "seed",
      analysis: analysis({
        summary:
          "Arjun asked only for the cheapest 2 or 3 BHK in Gachibowli and did not share a budget or timeline. He has not replied since two links were sent.",
        intent: "Just browsing",
        keyRequirements: ["2 or 3 BHK in Gachibowli", "Lowest price"],
        objections: ["Will only engage on price"],
        nextAction: "One short WhatsApp next week asking for a budget ceiling. Stop if he does not reply.",
        suggestedResponse:
          "Hi Arjun, I sent two Gachibowli options earlier. To avoid flooding you with the wrong prices, what is the maximum you want to spend for a 2 or 3 BHK? If you are only collecting prices for later, tell me and I will pause here.",
        score: 22,
        priority: "cold",
        urgencyFlag: false,
        urgencyReason: "No near-term deadline mentioned.",
        scoreReasoning: [
          "Budget and timeline were not mentioned.",
          "The message asks for the cheapest price and nothing else.",
        ],
      }),
    },
  ];

  return leads;
}
