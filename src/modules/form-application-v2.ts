// @ts-nocheck

const { ApplicationV2, HandlebarsApplicationMixin } = globalThis.foundry.applications.api;

function registerSelectHelper(): void {
    const handlebars = globalThis.Handlebars;
    if (!handlebars || handlebars.helpers?.select) {
        return;
    }

    handlebars.registerHelper("select", function selectHelper(selected: unknown, options: Record<string, unknown>) {
        const values = Array.isArray(selected)
            ? selected.map((value) => String(value ?? ""))
            : [String(selected ?? "")];
        const selectedValues = new Set(values);
        const template = document.createElement("template");
        template.innerHTML = String((options.fn as Function)(this));

        for (const option of template.content.querySelectorAll("option")) {
            if (selectedValues.has(option.value)) {
                option.setAttribute("selected", "selected");
            } else {
                option.removeAttribute("selected");
            }
        }

        return new handlebars.SafeString(template.innerHTML);
    });
}

async function submitMaestroForm(
    this: MaestroFormApplication,
    event: Event,
    _form: HTMLFormElement,
    formData: foundry.applications.ux.FormDataExtended
): Promise<void> {
    await this._updateObject(event, formData.object);
}

export function maestroFormPart(template: string): Record<string, unknown> {
    return {
        template,
        root: true
    };
}

export class MaestroFormApplication extends HandlebarsApplicationMixin(ApplicationV2) {
    data: Record<string, unknown>;

    constructor(data: Record<string, unknown> = {}, options: Record<string, unknown> = {}) {
        registerSelectHelper();
        super(options);
        this.data = data;
    }

    static DEFAULT_OPTIONS = {
        tag: "form",
        classes: ["sheet"],
        form: {
            closeOnSubmit: true,
            submitOnChange: false,
            handler: submitMaestroForm
        }
    };

    async getData(_options?: Record<string, unknown>): Promise<Record<string, unknown>> | Record<string, unknown> {
        return {};
    }

    protected override async _prepareContext(options: Record<string, unknown>): Promise<Record<string, unknown>> {
        const context = await super._prepareContext(options);
        return Object.assign(context, await this.getData(options));
    }

    protected override async _onRender(context: Record<string, unknown>, options: Record<string, unknown>): Promise<void> {
        await super._onRender(context, options);
        this.form?.setAttribute("autocomplete", "off");
        this.activateListeners($(this.element));
    }

    activateListeners(_html: JQuery): void {
        return;
    }

    async _updateObject(_event: Event, _formData: Record<string, unknown>): Promise<void> {
        return;
    }
}
