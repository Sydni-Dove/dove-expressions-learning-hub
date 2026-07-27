/**
 * PROTOTYPE SAMPLE DATA — Messaging, Community, and Prayer Requests are now live (see
 * 08-feature-status.md); mockConversations/mockCommunityPosts/mockPrayerRequests below remain
 * only for the small dashboard preview widgets. The Unified Library (mockResources) and
 * Notifications are still prototype-only, not yet backed by real dp_resources/dp_notifications
 * tables. Every page that reads from this file renders a visible "Prototype preview" badge so
 * it's never confused with live data.
 */

export const mockConversations = [
  {
    id: "c1",
    name: "Pastor Renee (Mentor)",
    lastMessage: "So proud of how you responded to the Lord in that last Meeting With God entry.",
    unread: 2,
    time: "9:14 AM"
  },
  {
    id: "c2",
    name: "Cohort — Hearing God Weeks 11-15",
    lastMessage: "Reminder: group discussion Thursday at 7pm ET.",
    unread: 0,
    time: "Yesterday"
  },
  {
    id: "c3",
    name: "Faculty Support",
    lastMessage: "Your Scripture Journey week 6 has been marked complete.",
    unread: 0,
    time: "Mon"
  }
];

export const mockCommunityPosts = [
  {
    id: "p1",
    space: "Hearing God",
    author: "Jasmine T.",
    body: "Been sitting with Isaiah 30:21 all week — \"This is the way, walk in it.\" Anyone else being drawn to obedience in the small things right now?",
    reactions: 12,
    comments: 4,
    time: "2h ago"
  },
  {
    id: "p2",
    space: "Testimonies",
    author: "Marcus B.",
    body: "Six months ago my mentor and I mapped a strategy from a dream about building. Today I signed the paperwork for the ministry nonprofit. Revelation to execution is real.",
    reactions: 34,
    comments: 9,
    time: "1d ago"
  },
  {
    id: "p3",
    space: "Kingdom Mandate",
    author: "Dana R.",
    body: "Working through the mandate tool this week — the question \"what is for now vs. for later\" wrecked me in the best way.",
    reactions: 18,
    comments: 6,
    time: "3d ago"
  }
];

export const mockPrayerRequests = [
  { id: "pr1", title: "Wisdom for a job transition", visibility: "cohort", status: "open", isAnonymous: false, author: "You" },
  { id: "pr2", title: "Healing for my mother", visibility: "mentor", status: "answered", isAnonymous: false, author: "You" },
  { id: "pr3", title: "Clarity on a relationship", visibility: "community", status: "open", isAnonymous: true, author: "Anonymous" }
];

export const mockResources = [
  { id: "r1", title: "Two-Way Journaling Starter Guide", category: "Guide", access: "free", pathways: ["hear_god"] },
  { id: "r2", title: "25-Week Scripture Journey Companion", category: "Journal", access: "enrolled", pathways: ["draw_near"] },
  { id: "r3", title: "Kingdom Mandate Workbook (Printable)", category: "Workbook", access: "purchased", pathways: ["kingdom_mandate"] },
  { id: "r4", title: "Spiritual Wiring Categories Reference Card", category: "Reference", access: "free", pathways: ["kingdom_mandate"] },
  { id: "r5", title: "Meetings With God Journal", category: "Journal", access: "purchased", pathways: ["draw_near"] },
  { id: "r6", title: "Dream Journal & Interpretation Companion", category: "Journal", access: "purchased", pathways: ["hear_god"] },
  { id: "r7", title: "Mind of Christ Reflection Workbook", category: "Workbook", access: "enrolled", pathways: ["rooted"] },
  { id: "r8", title: "Spiritual Wiring Assessment & Planning Tools", category: "Assessment", access: "enrolled", pathways: ["kingdom_mandate"] }
];

export const mockNotifications = [
  { id: "n1", type: "session", body: "Your mentor scheduled a follow-up session for Thursday.", time: "1h ago", read: false },
  { id: "n2", type: "feedback", body: "New feedback on your Two-Way Journaling assignment.", time: "5h ago", read: false },
  { id: "n3", type: "announcement", body: "Cohort milestone: Week 15 complete for 80% of your cohort.", time: "1d ago", read: true }
];
