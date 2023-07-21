class InitiativeSorting
{
	static MODULE_ID = 'dnd5e-correct-initiative-sorting';
	static MODULE_NAME = 'Correct Initiative Sorting';

	/**
	 * Patch the combatant sorting
	 *
	 * @param
	 * @param
	 * @return
	 */
	static wrappedSortCombatants(a, b)
	{
		// We need to floor the initiative in case the dnd5e tiebreaker setting is on; we'll do that our own way
		const ia = Number.isNumeric(a.initiative) ? Math.floor(a.initiative) : -Infinity;
		const ib = Number.isNumeric(b.initiative) ? Math.floor(b.initiative) : -Infinity;

		// We only need to do anything special if the initiatives matched
		if ((ib - ia) == 0)
		{
			const tiebreakerStyle = game.settings.get(InitiativeSorting.MODULE_ID, 'tiebreakerStyle');
			// Are we also using Dexterity to break ties and, if so, how?
			const dexTiebreakerOrder = game.settings.get(InitiativeSorting.MODULE_ID, 'dexTiebreakerOrder');
			const useDexTiebreaker = game.settings.get('dnd5e', 'initiativeDexTiebreaker');
			
			const creatureTypeSort = InitiativeSorting.creatureTypeSort(a, b);
			const dexSort = InitiativeSorting.dexteritySort(a, b);
			
			if (useDexTiebreaker && dexTiebreakerOrder && dexSort != 0) // We are including Dexterity in our tiebreaking and using it first
			{
				console.log("Sorting based on dexterity (before)");
				return dexSort;
			}
			if (creatureTypeSort != 0)
			{
				console.log("Sorting based on creature type");
				return creatureTypeSort;
			}
			if (useDexTiebreaker && !dexTiebreakerOrder && dexSort != 0) // We are including Dexterity in our tiebreaking and using it second
			{
				console.log("Sorting based on dexterity (after)");
				return dexSort;
			}
			
			// If we're doing roll-off style, do that now
			if (tiebreakerStyle == 'roll')
			{
				console.log("Sorting based on rolloff");
				return IntiativeSorting.rollOff(a, b);
			}
			
			// Otherwise, just sort by name
			console.log("Sorting based on name");
			return (a.name > b.name ? 1 : -1);
		}
		return (ib - ia);
	}
	
	/**
	 * Given two combatants, return the sort value based on dexterity
	 * 
	 * @param
	 * @param
	 * @return	Integer
	 */
	static dexteritySort(a, b)
	{
		const da = a.actor.system.abilities.dex.value;
		const db = b.actor.system.abilities.dex.value;
		if (da > db)
			return -1;
		if (db > da)
			return 1;
		return 0;
	}
	
	/**
	 * Given two combatants, return the sort value based on actor type
	 * (PC or NPC)
	 * 
	 * @param
	 * @param
	 * @return	Integer
	 */
	static creatureTypeSort(a, b)
	{
		const tiebreakerStyle = game.settings.get(InitiativeSorting.MODULE_ID, 'tiebreakerStyle');
		if (tiebreakerStyle == 'roll') // Don't sort by creature type if we've designated roll-off
			return 0;
		const flip = tiebreakerStyle == 'npc' ? -1 : 1;
		if (a.isNPC && !b.isNPC)
			return 1 * flip;
		if (!a.isNPC && b.isNPC)
			return -1 * flip;
		return 0;
	}
	
	/**
	 * Roll off between two combatants
	 * 
	 * @param
	 * @param
	 * @return	Integer
	 */
	static rollOff(a, b)
	{
		ui.notifications.warning("A rolloff would have occurred");
		return 0;
	}
}

/**
 * Register settings
 */
Hooks.on('setup', () => {
	// const debouncedReload = foundry.utils.debounce(() => window.location.reload(), 100);
	const debounceReload = (function() { })();

	game.settings.register(InitiativeSorting.MODULE_ID, 'tiebreakerStyle', {
		name: 'Creature Tiebreaker Style',
		hint: 'Note: If the dnd5e system setting for Dexterity tiebreakers is enabled, it will also be accounted for',
		scope: 'world',
		config: true,
		type: String,
		default: "pc",
		choices: {
			'pc': 'PCs, then NPCs',
			'npc': 'NPCs, then PCs',
			'roll': 'Roll off'
		},
		onChange: debouncedReload
	});

	game.settings.register(InitiativeSorting.MODULE_ID, 'dexTiebreakerOrder', {
		name: 'Dexterity Priority',
		hint: 'If the dnd5e system setting for Dexterity tiebreakers is enabled, does it apply before or after the selected tiebreaker style?',
		scope: 'world',
		config: true,
		type: Boolean,
		default: true,
		choices: {
			true: 'Dexterity first, then tiebreaker',
			false: 'Tiebreaker first, then Dexterity'
		},
		onChange: debouncedReload
	});
});

/**
 * On initialization, patch the actor document and the Combatant
 * prototype's initiative formula.
 */
Hooks.once("init", function() {
	libWrapper.register(InitiativeSorting.MODULE_ID, 'Combat.prototype._sortCombatants', function(wrapped, ...args) {
		const originalResult = wrapped(...args); // Then just discard it.
		return InitiativeSorting.wrappedSortCombatants(...args);
	}, 'WRAPPER');
});

/**
 * When the game environment is ready, if a combat is already active,
 * turn on our socket.
 */
Hooks.once("ready", function() {
	if (!game.modules.get('lib-wrapper')?.active && game.user.isGM)
	{
		ui.notifications.error(`Module ${moduleName} requires the 'libWrapper' module. Please install and activate it.`);
	}
});