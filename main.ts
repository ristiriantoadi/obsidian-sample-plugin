import { App, Modal, Notice, Plugin, PluginSettingTab, Setting,MarkdownView,normalizePath } from 'obsidian';
import aes from 'crypto-js/aes';
import CryptoJS from "crypto-js/core";
interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	//this seems to be where the plugin started
	async onload() {
		console.log('loading plugin');

		// let leaf = this.app.workspace.activeLeaf;
		// if (leaf) {
		// 	const currentView = leaf.view as MarkdownView;
		// 	const currentFile = currentView.file
		// 	// return {currentView, currentFile};
		// 	// existingContent = existingContent ?? (await this.app.vault.read(file) + '\r\r');
		// 	// var text = await this.app.vault.read(currentFile)
		// 	console.log("currentfile")
		// 	console.log(currentFile)
		// }

		// // INIT
		// var myString   = "blablabla Card game bla";
		// var myPassword = "myPassword";

		// // PROCESS
		// var encrypted = aes.encrypt(myString, myPassword);
		// console.log("encrypted: "+encrypted)
		// var decrypted = aes.decrypt(encrypted, myPassword);
		// console.log("decrypted: "+decrypted.toString(CryptoJS.enc.Utf8))


		// console.log(sha256("Message"));
		await this.loadSettings();

		this.addRibbonIcon('dice', 'Sample Plugin', () => {
			new Notice('This is a notice!');
		});

		this.addStatusBarItem().setText('Status Bar Text');

		this.addCommand({
			id: 'open-sample-modal',
			name: 'Open Sample Modal',
			// callback: () => {
			// 	console.log('Simple Callback');
			// },
			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf) {
					// const currentView = leaf.view as MarkdownView;
					// const currentFile = currentView.file
					// this.app.vault.read(currentFile).then(text=>{
					// 	console.log("text")
					// 	console.log(text)
					// })
					const loremIpsumPath = normalizePath(this.app.vault.getRoot().path+"lorem ipsum.md")
					this.app.vault.adapter.read(loremIpsumPath).then(text=>{
						var decrypted = aes.decrypt(text, "myPassword").toString(CryptoJS.enc.Utf8)
						return this.app.vault.adapter.write(loremIpsumPath,decrypted,()=>{
							console.log("done")
						})	
					})
					// 	// console.log(text)
					// 	// PROCESS
					// 	var encrypted = aes.encrypt(text, "myPassword");
					// 	// console.log("encrypted: "+encrypted)
					// 	return this.app.vault.adapter.write(loremIpsumPath,encrypted.toString(),()=>{
					// 		console.log("done")
					// 	})
					// })

					// var decrypted = aes.decrypt(encrypted, myPassword);
					// console.log("decrypted: "+decrypted.toString(CryptoJS.enc.Utf8))
					
					if (!checking) {
						
						new SampleModal(this.app).open();
					}
					return true;
				}
				return false;
			}
		});

		this.addSettingTab(new SampleSettingTab(this.app, this));

		this.registerCodeMirror((cm: CodeMirror.Editor) => {
			console.log('codemirror', cm);
		});

		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {
		console.log('unloading plugin');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		let {contentEl} = this;
		contentEl.setText('Hello WOrld!');
	}

	onClose() {
		let {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings for my awesome plugin.'});

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue('')
				.onChange(async (value) => {
					console.log('Secret: ' + value);
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
