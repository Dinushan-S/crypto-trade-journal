import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';

export const load: PageServerLoad = async ({ locals: { convex } }) => {
	const mistakes: any[] = await convex.query(api.mistakes.getMistakes, {}).catch(() => []);
	const allMistakes = mistakes.map((m: any) => ({ ...m, id: m._id }));

	const totalMistakes = allMistakes.length;

	const categoryCounts: Record<string, number> = {};
	allMistakes.forEach((m: any) => {
		if (m.category) {
			categoryCounts[m.category] = (categoryCounts[m.category] || 0) + 1;
		}
	});

	let topCategory = 'None';
	let topCategoryCount = 0;
	Object.entries(categoryCounts).forEach(([cat, cnt]) => {
		if (cnt > topCategoryCount) {
			topCategory = cat;
			topCategoryCount = cnt;
		}
	});

	const lessonsCount = allMistakes.filter(
		(m: any) => m.lesson_learned && m.lesson_learned.trim().length > 0
	).length;

	return {
		mistakes: allMistakes,
		totalMistakes,
		topCategory,
		topCategoryCount,
		lessonsCount
	};
};

export const actions: Actions = {
	delete: async ({ request, locals: { convex } }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		if (!id) return fail(400, { error: 'Missing mistake ID' });

		try {
			await convex.mutation(api.mistakes.deleteMistake, { id: id as Id<'mistakes'> });
			return { success: true };
		} catch (error: any) {
			return fail(500, { error: error.message });
		}
	}
};
