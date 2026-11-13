import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';

export const getUserSettings = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return null;
		const row = await ctx.db
			.query('user_settings')
			.withIndex('by_user', (q) => q.eq('userId', userId))
			.first();
		return row ?? { my_session_start: '04:30', my_session_end: '12:30', view_tz: 'utc' };
	}
});

export const upsertUserSettings = mutation({
	args: {
		my_session_start: v.optional(v.string()),
		my_session_end: v.optional(v.string()),
		view_tz: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error('Unauthenticated');
		if (args.my_session_start && !/^\d{2}:\d{2}$/.test(args.my_session_start))
			throw new Error('Invalid my_session_start');
		if (args.my_session_end && !/^\d{2}:\d{2}$/.test(args.my_session_end))
			throw new Error('Invalid my_session_end');
		if (args.view_tz && args.view_tz !== 'utc' && args.view_tz !== 'colombo')
			throw new Error('Invalid view_tz');
		const existing = await ctx.db
			.query('user_settings')
			.withIndex('by_user', (q) => q.eq('userId', userId))
			.first();
		const now = new Date().toISOString();
		if (existing) {
			await ctx.db.patch(existing._id, { ...args, updated_at: now });
			return existing._id;
		}
		return await ctx.db.insert('user_settings', {
			userId,
			...args,
			created_at: now,
			updated_at: now
		});
	}
});
