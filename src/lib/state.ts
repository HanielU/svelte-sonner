import type { ComponentType } from 'svelte';
import type { HeightT, ExternalToast, PromiseData, PromiseT, ToastT, ToastTypes } from './types.js';
import { get, writable } from 'svelte/store';

let toastsCounter = 0;

function createToastState() {
	const toasts = writable<Array<ToastT>>([]);
	const heights = writable<HeightT[]>([]);

	function addToast(data: ToastT) {
		if (typeof document !== 'undefined') {
			toasts.update((prev) => [...prev, data]);
		}
	}

	function create(
		data: ExternalToast & {
			message?: string | ComponentType;
			type?: ToastTypes;
			promise?: PromiseT;
		}
	) {
		const { message, ...rest } = data;
		const id =
			typeof data?.id === 'number' || (data.id && data.id?.length > 0)
				? data.id
				: toastsCounter++;

		const $toasts = get(toasts);

		const alreadyExists = $toasts.find((toast) => {
			return toast.id === id;
		});

		if (alreadyExists) {
			toasts.update((prev) =>
				prev.map((toast) => {
					if (toast.id === id) {
						return { ...toast, ...data, id, title: message };
					}
					return toast;
				})
			);
		} else {
			addToast({ title: message, ...rest, id });
		}

		return id;
	}

	function dismiss(id?: number | string) {
		if (!id) {
			toasts.set([]);
			return;
		}
		toasts.update((prev) => prev.filter((toast) => toast.id !== id));

		return id;
	}

	function message(message: string | ComponentType, data?: ExternalToast) {
		return create({ ...data, message });
	}

	function error(message: string | ComponentType, data?: ExternalToast) {
		return create({ ...data, message, type: 'error' });
	}

	function success(message: string | ComponentType, data?: ExternalToast) {
		return create({ ...data, type: 'success', message });
	}

	function info(message: string | ComponentType, data?: ExternalToast) {
		return create({ ...data, type: 'info', message });
	}

	function warning(message: string | ComponentType, data?: ExternalToast) {
		return create({ ...data, type: 'warning', message });
	}

	function loading(message: string | ComponentType, data?: ExternalToast) {
		return create({ ...data, type: 'loading', message });
	}

	function promise<ToastData>(promise: PromiseT<ToastData>, data?: PromiseData<ToastData>) {
		if (!data) {
			// Nothing to show
			return;
		}

		let id: string | number | undefined = undefined;
		if (data.loading !== undefined) {
			id = create({
				...data,
				promise,
				type: 'loading',
				message: data.loading
			});
		}

		const p = promise instanceof Promise ? promise : promise();

		let shouldDismiss = id !== undefined;

		p.then((response) => {
			// TODO: Clean up TS here, response has incorrect type
			// @ts-expect-error: Incorrect response type
			if (response && typeof response.ok === 'boolean' && !response.ok) {
				shouldDismiss = false;
				const message =
					typeof data.error === 'function'
						? // @ts-expect-error: Incorrect response type
							data.error(`HTTP error! status: ${response.status}`)
						: data.error;
				create({ id, type: 'error', message });
			} else if (data.success !== undefined) {
				shouldDismiss = false;
				const message =
					// @ts-expect-error: TODO: Better function checking
					typeof data.success === 'function' ? data.success(response) : data.success;
				create({ id, type: 'success', message });
			}
		})
			.catch((error) => {
				if (data.error !== undefined) {
					shouldDismiss = false;
					const message =
						// @ts-expect-error: TODO: Better function checking
						typeof data.error === 'function' ? data.error(error) : data.error;
					create({ id, type: 'error', message });
				}
			})
			.finally(() => {
				if (shouldDismiss) {
					// Toast is still in load state (and will be indefinitely — dismiss it)
					dismiss(id);
					id = undefined;
				}

				data.finally?.();
			});

		return id;
	}

	function custom<T extends ComponentType = ComponentType>(
		component: T,
		data?: ExternalToast<T>
	) {
		const id = data?.id || toastsCounter++;
		create({ component, id, ...data });

		return id;
	}

	function removeHeight(id: number | string) {
		heights.update((prev) => prev.filter((height) => height.toastId !== id));
	}

	function addHeight(height: HeightT) {
		heights.update((prev) => [...prev, height]);
	}

	return {
		// methods
		create,
		addToast,
		dismiss,
		message,
		error,
		success,
		info,
		warning,
		loading,
		promise,
		custom,
		removeHeight,
		addHeight,
		// stores
		toasts,
		heights
	};
}

export const toastState = createToastState();

// bind this to the toast function
function toastFunction(message: string | ComponentType, data?: ExternalToast) {
	const id = data?.id || toastsCounter++;

	toastState.addToast({
		title: message,
		...data,
		id
	});
	return id;
}

const basicToast = toastFunction;

// We use `Object.assign` to maintain the correct types as we would lose them otherwise
export const toast = Object.assign(basicToast, {
	success: toastState.success,
	info: toastState.info,
	warning: toastState.warning,
	error: toastState.error,
	custom: toastState.custom,
	message: toastState.message,
	promise: toastState.promise,
	dismiss: toastState.dismiss,
	loading: toastState.loading
});

export const useEffect = (subscribe: unknown) => ({ subscribe });
