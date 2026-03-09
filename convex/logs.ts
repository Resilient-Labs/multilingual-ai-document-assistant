import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("logs").collect();
  },
});

export const add = mutation({
  args: {
    message: v.string(),
    level: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("logs", {
      message: args.message,
      level: args.level,
      timestamp: Date.now(),
    });
  },
});
