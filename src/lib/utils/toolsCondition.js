// src/lib/utils/toolConditions.js
/**
 * Utility functions for tool condition management
 */

// Condition definitions
export const TOOL_CONDITIONS = {
	NORMAL: 'normal',
	BERMASALAH: 'bermasalah',
	RUSAK: 'rusak',
	UNKNOWN: 'unknown'
};

// Condition priorities for sorting (higher = worse condition)
export const CONDITION_PRIORITY = {
	[TOOL_CONDITIONS.RUSAK]: 3,
	[TOOL_CONDITIONS.BERMASALAH]: 2,
	[TOOL_CONDITIONS.NORMAL]: 1,
	[TOOL_CONDITIONS.UNKNOWN]: 0
};

// Condition labels for display
export const CONDITION_LABELS = {
	[TOOL_CONDITIONS.NORMAL]: 'Normal',
	[TOOL_CONDITIONS.BERMASALAH]: 'Bermasalah',
	[TOOL_CONDITIONS.RUSAK]: 'Rusak',
	[TOOL_CONDITIONS.UNKNOWN]: 'Tidak Diketahui'
};

// Condition icons
export const CONDITION_ICONS = {
	[TOOL_CONDITIONS.NORMAL]: '✅',
	[TOOL_CONDITIONS.BERMASALAH]: '⚠️',
	[TOOL_CONDITIONS.RUSAK]: '🔴',
	[TOOL_CONDITIONS.UNKNOWN]: '❓'
};

// Condition colors for styling
export const CONDITION_COLORS = {
	[TOOL_CONDITIONS.NORMAL]: {
		bg: 'bg-green-100',
		text: 'text-green-800',
		border: 'border-green-200',
		accent: 'text-green-600'
	},
	[TOOL_CONDITIONS.BERMASALAH]: {
		bg: 'bg-yellow-100',
		text: 'text-yellow-800',
		border: 'border-yellow-200',
		accent: 'text-yellow-600'
	},
	[TOOL_CONDITIONS.RUSAK]: {
		bg: 'bg-red-100',
		text: 'text-red-800',
		border: 'border-red-200',
		accent: 'text-red-600'
	},
	[TOOL_CONDITIONS.UNKNOWN]: {
		bg: 'bg-gray-100',
		text: 'text-gray-800',
		border: 'border-gray-200',
		accent: 'text-gray-600'
	}
};

/**
 * Get condition label for display
 * @param {string} condition - Condition value
 * @returns {string} - Display label
 */
export function getConditionLabel(condition) {
	return CONDITION_LABELS[condition] || CONDITION_LABELS[TOOL_CONDITIONS.UNKNOWN];
}

/**
 * Get condition icon
 * @param {string} condition - Condition value
 * @returns {string} - Icon emoji
 */
export function getConditionIcon(condition) {
	return CONDITION_ICONS[condition] || CONDITION_ICONS[TOOL_CONDITIONS.UNKNOWN];
}

/**
 * Get condition color classes
 * @param {string} condition - Condition value
 * @returns {Object} - Color classes object
 */
export function getConditionColors(condition) {
	return CONDITION_COLORS[condition] || CONDITION_COLORS[TOOL_CONDITIONS.UNKNOWN];
}

/**
 * Get CSS classes for condition badge
 * @param {string} condition - Condition value
 * @param {string} size - Badge size ('small', 'normal', 'large')
 * @returns {string} - Complete CSS class string
 */
export function getConditionBadgeClass(condition, size = 'normal') {
	const colors = getConditionColors(condition);

	const sizeClasses = {
		small: 'px-2 py-0.5 text-xs',
		normal: 'px-2.5 py-0.5 text-xs',
		large: 'px-3 py-1 text-sm'
	};

	const baseClasses = 'inline-flex items-center font-medium rounded-full border';
	const size_class = sizeClasses[size] || sizeClasses.normal;

	return `${baseClasses} ${size_class} ${colors.bg} ${colors.text} ${colors.border}`;
}

/**
 * Check if condition requires attention
 * @param {string} condition - Condition value
 * @returns {boolean} - True if condition needs attention
 */
export function isProblematicCondition(condition) {
	return condition === TOOL_CONDITIONS.BERMASALAH || condition === TOOL_CONDITIONS.RUSAK;
}

/**
 * Get worst condition from array of conditions
 * @param {Array<string>} conditions - Array of condition values
 * @returns {string} - Worst condition
 */
export function getWorstCondition(conditions) {
	if (!Array.isArray(conditions) || conditions.length === 0) {
		return TOOL_CONDITIONS.UNKNOWN;
	}

	let worstCondition = TOOL_CONDITIONS.NORMAL;
	let worstPriority = 0;

	conditions.forEach((condition) => {
		const priority = CONDITION_PRIORITY[condition] || 0;
		if (priority > worstPriority) {
			worstPriority = priority;
			worstCondition = condition;
		}
	});

	return worstCondition;
}

/**
 * Calculate condition statistics from array of tools
 * @param {Array} tools - Array of tools with condition property
 * @returns {Object} - Condition statistics
 */
export function calculateConditionStats(tools) {
	const stats = {
		total: tools.length,
		[TOOL_CONDITIONS.NORMAL]: 0,
		[TOOL_CONDITIONS.BERMASALAH]: 0,
		[TOOL_CONDITIONS.RUSAK]: 0,
		[TOOL_CONDITIONS.UNKNOWN]: 0
	};

	tools.forEach((tool) => {
		const condition = tool.condition || TOOL_CONDITIONS.UNKNOWN;
		if (stats.hasOwnProperty(condition)) {
			stats[condition]++;
		} else {
			stats[TOOL_CONDITIONS.UNKNOWN]++;
		}
	});

	return stats;
}

/**
 * Calculate health percentage based on condition stats
 * @param {Object} stats - Condition statistics object
 * @returns {number} - Health percentage (0-100)
 */
export function calculateHealthPercentage(stats) {
	if (stats.total === 0) return 100;

	const normalCount = stats[TOOL_CONDITIONS.NORMAL] || 0;
	return Math.round((normalCount / stats.total) * 100);
}

/**
 * Get health status category based on percentage
 * @param {number} percentage - Health percentage
 * @returns {Object} - Health status with category and color
 */
export function getHealthStatus(percentage) {
	if (percentage >= 90) {
		return {
			category: 'excellent',
			label: 'Sangat Baik',
			color: 'text-green-600',
			bgColor: 'bg-green-50',
			borderColor: 'border-green-200'
		};
	} else if (percentage >= 75) {
		return {
			category: 'good',
			label: 'Baik',
			color: 'text-blue-600',
			bgColor: 'bg-blue-50',
			borderColor: 'border-blue-200'
		};
	} else if (percentage >= 50) {
		return {
			category: 'warning',
			label: 'Perlu Perhatian',
			color: 'text-yellow-600',
			bgColor: 'bg-yellow-50',
			borderColor: 'border-yellow-200'
		};
	} else {
		return {
			category: 'critical',
			label: 'Kritis',
			color: 'text-red-600',
			bgColor: 'bg-red-50',
			borderColor: 'border-red-200'
		};
	}
}

/**
 * Sort tools by condition priority (worst first)
 * @param {Array} tools - Array of tools
 * @returns {Array} - Sorted tools array
 */
export function sortByConditionPriority(tools) {
	return [...tools].sort((a, b) => {
		const priorityA = CONDITION_PRIORITY[a.condition] || 0;
		const priorityB = CONDITION_PRIORITY[b.condition] || 0;

		// Sort by priority (descending), then by name (ascending)
		if (priorityA !== priorityB) {
			return priorityB - priorityA;
		}

		const nameA = a.tool_id?.name || a.name || '';
		const nameB = b.tool_id?.name || b.name || '';
		return nameA.localeCompare(nameB);
	});
}

/**
 * Filter tools by condition
 * @param {Array} tools - Array of tools
 * @param {string|Array<string>} conditions - Condition(s) to filter by
 * @returns {Array} - Filtered tools array
 */
export function filterByCondition(tools, conditions) {
	if (!conditions) return tools;

	const conditionArray = Array.isArray(conditions) ? conditions : [conditions];

	return tools.filter((tool) => {
		const toolCondition = tool.condition || TOOL_CONDITIONS.UNKNOWN;
		return conditionArray.includes(toolCondition);
	});
}

/**
 * Export tools data to CSV format
 * @param {Array} tools - Array of tools
 * @param {string} filename - Output filename
 */
export function exportToolsToCSV(tools, filename = 'tools-condition-report.csv') {
	const headers = [
		'ID Alat',
		'Nama Alat',
		'Deskripsi',
		'Kategori',
		'Kondisi',
		'Project',
		'Jumlah',
		'Catatan',
		'Tanggal Update'
	];

	const csvContent = [
		headers.join(','),
		...tools.map((tool) =>
			[
				`"${tool.tool_id?.id || tool.id || ''}"`,
				`"${tool.tool_id?.name || tool.name || ''}"`,
				`"${tool.tool_id?.description || tool.description || ''}"`,
				`"${tool.tool_id?.category || tool.category || ''}"`,
				`"${getConditionLabel(tool.condition)}"`,
				`"${tool.project_id?.name || ''}"`,
				tool.quantity || 0,
				`"${tool.notes || ''}"`,
				`"${tool.date_updated ? new Date(tool.date_updated).toLocaleDateString('id-ID') : ''}"`
			].join(',')
		)
	].join('\n');

	// Create and download file
	const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
	const link = document.createElement('a');
	link.href = URL.createObjectURL(blob);
	link.download = filename;
	link.click();
}

/**
 * Format date for display in Indonesian locale
 * @param {string|Date} date - Date to format
 * @param {Object} options - Formatting options
 * @returns {string} - Formatted date string
 */
export function formatDate(date, options = {}) {
	if (!date) return '-';

	const defaultOptions = {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	};

	const formatOptions = { ...defaultOptions, ...options };

	try {
		return new Date(date).toLocaleDateString('id-ID', formatOptions);
	} catch (error) {
		console.error('Error formatting date:', error);
		return '-';
	}
}

/**
 * Format datetime for display
 * @param {string|Date} date - Date to format
 * @returns {string} - Formatted datetime string
 */
export function formatDateTime(date) {
	return formatDate(date, {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

/**
 * Debounce function for limiting API calls
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} - Debounced function
 */
export function debounce(func, delay) {
	let timeoutId;

	return function (...args) {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => func.apply(this, args), delay);
	};
}

/**
 * Generate action recommendations based on condition stats
 * @param {Object} stats - Condition statistics
 * @returns {Array<Object>} - Array of recommendation objects
 */
export function generateActionRecommendations(stats) {
	const recommendations = [];

	if (stats[TOOL_CONDITIONS.RUSAK] > 0) {
		recommendations.push({
			priority: 'high',
			icon: '🔴',
			title: 'Perbaikan Segera Diperlukan',
			description: `${stats[TOOL_CONDITIONS.RUSAK]} alat rusak memerlukan perbaikan segera`,
			action: 'Buat laporan maintenance untuk alat rusak',
			actionUrl: '/maintenance/create?condition=rusak'
		});
	}

	if (stats[TOOL_CONDITIONS.BERMASALAH] > 0) {
		recommendations.push({
			priority: 'medium',
			icon: '⚠️',
			title: 'Perawatan Preventif',
			description: `${stats[TOOL_CONDITIONS.BERMASALAH]} alat bermasalah perlu diperiksa`,
			action: 'Jadwalkan inspeksi rutin',
			actionUrl: '/maintenance/create?condition=bermasalah'
		});
	}

	const problematicPercentage =
		((stats[TOOL_CONDITIONS.RUSAK] + stats[TOOL_CONDITIONS.BERMASALAH]) / stats.total) * 100;

	if (problematicPercentage > 20) {
		recommendations.push({
			priority: 'high',
			icon: '📊',
			title: 'Evaluasi Sistem Maintenance',
			description: `${Math.round(problematicPercentage)}% alat memerlukan perhatian`,
			action: 'Tinjau strategi perawatan alat',
			actionUrl: '/tools/condition-dashboard'
		});
	}

	return recommendations.sort((a, b) => {
		const priorityOrder = { high: 3, medium: 2, low: 1 };
		return priorityOrder[b.priority] - priorityOrder[a.priority];
	});
}

// src/lib/utils/notifications.js
/**
 * Notification utilities for tool condition alerts
 */

/**
 * Show toast notification
 * @param {string} message - Notification message
 * @param {string} type - Notification type ('success', 'error', 'warning', 'info')
 * @param {number} duration - Duration in milliseconds
 */
export function showToast(message, type = 'info', duration = 3000) {
	// Create toast element
	const toast = document.createElement('div');
	toast.className = `fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg transition-all duration-300 transform translate-x-full`;

	// Set type-specific styles
	const typeStyles = {
		success: 'bg-green-100 text-green-800 border-green-200',
		error: 'bg-red-100 text-red-800 border-red-200',
		warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
		info: 'bg-blue-100 text-blue-800 border-blue-200'
	};

	toast.className += ` ${typeStyles[type] || typeStyles.info} border`;
	toast.textContent = message;

	// Add to document
	document.body.appendChild(toast);

	// Animate in
	setTimeout(() => {
		toast.classList.remove('translate-x-full');
		toast.classList.add('translate-x-0');
	}, 100);

	// Remove after duration
	setTimeout(() => {
		toast.classList.add('translate-x-full');
		setTimeout(() => {
			if (document.body.contains(toast)) {
				document.body.removeChild(toast);
			}
		}, 300);
	}, duration);
}

/**
 * Show condition change notification
 * @param {string} toolName - Tool name
 * @param {string} oldCondition - Previous condition
 * @param {string} newCondition - New condition
 */
export function showConditionChangeNotification(toolName, oldCondition, newCondition) {
	const oldLabel = getConditionLabel(oldCondition);
	const newLabel = getConditionLabel(newCondition);
	const icon = getConditionIcon(newCondition);

	const message = `${icon} ${toolName}: ${oldLabel} → ${newLabel}`;
	const type = isProblematicCondition(newCondition) ? 'warning' : 'success';

	showToast(message, type, 4000);
}

export default {
	// Condition constants
	TOOL_CONDITIONS,
	CONDITION_PRIORITY,
	CONDITION_LABELS,
	CONDITION_ICONS,
	CONDITION_COLORS,

	// Utility functions
	getConditionLabel,
	getConditionIcon,
	getConditionColors,
	getConditionBadgeClass,
	isProblematicCondition,
	getWorstCondition,
	calculateConditionStats,
	calculateHealthPercentage,
	getHealthStatus,
	sortByConditionPriority,
	filterByCondition,
	exportToolsToCSV,
	formatDate,
	formatDateTime,
	debounce,
	generateActionRecommendations,

	// Notification functions
	showToast,
	showConditionChangeNotification
};

// File ini sudah tidak digunakan. Semua logic terkait kondisi alat/tools telah dihapus untuk fokus pada Inventory.
