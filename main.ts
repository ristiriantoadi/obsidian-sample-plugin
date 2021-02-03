import { App, Modal, Notice, Plugin, PluginSettingTab, Setting,MarkdownView,normalizePath, TextComponent,ButtonComponent } from 'obsidian';
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
	startLineofCurrentBlock:Number=0

	getStartLineOfCurrentBlock(cm:CodeMirror.Editor):Number{
		const cursorLine = cm.getCursor().line
		const lines = cm.getValue().split("\n")
		
		//get start of block
		var startLineOfCurrentBlock = this.startLineofCurrentBlock
		var currentLine = cursorLine;
		while(currentLine>=0 && lines[currentLine] != ''){
			startLineOfCurrentBlock=currentLine;
			currentLine--;
		}
		return startLineOfCurrentBlock;
	}

	//this seems to be where the plugin started
	async onload() {
		console.log('loading plugin');

		await this.loadSettings();


		// this.addRibbonIcon('dice', 'Sample Plugin', () => {
		// 	new Notice('This is a notice!');
		// });

		this.addRibbonIcon('dice', 'Encryption', () => {
			// console.log("encrypt")
			new EncryptionModal(this.app).open()
		});

		this.addRibbonIcon('dice', 'Decryption', () => {
			// console.log("encrypt")
			new DecryptionModal(this.app).open()
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
					if (!checking) {
						const view = leaf.view as MarkdownView
						view.showSearch(true)
						// new SampleModal(this.app).open();
					}
					return true;
				}
				return false;
			}
		});

		this.addSettingTab(new SampleSettingTab(this.app, this));

		this.registerCodeMirror((cm: CodeMirror.Editor) => {
			cm.on("cursorActivity",(cm)=>{
				//get current block
				var startLineOfCurrentBlock = this.getStartLineOfCurrentBlock(cm);
				if(startLineOfCurrentBlock != this.startLineofCurrentBlock){
					console.log("block changed")
					this.startLineofCurrentBlock=startLineOfCurrentBlock
				}
			})
		});

		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			// console.log('click', evt);
			const view = this.app.workspace.activeLeaf.view as MarkdownView
			// console.log("MarkdownView")
			// console.log(view)
			// console.log("MarkdownView data")
			// console.log(view.data)
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


class EncryptionModal extends Modal{
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const currentView = this.app.workspace.activeLeaf.view as MarkdownView;
		const currentFile = currentView.file
		const filename=currentFile.name
		let {modalEl,titleEl,contentEl} = this;
		titleEl.setText(`Encrypt: ${filename}`);
		contentEl.addClass("encryption")
		var inputKey = new TextComponent(contentEl).setPlaceholder("Enter key ... ")
		inputKey.inputEl.type="password"
		const confirmKey = new TextComponent(contentEl).setPlaceholder("Confirm key ... ")
		confirmKey.inputEl.type="password"
		new ButtonComponent(contentEl).setButtonText("Encrypt").onClick(()=>{
			if(inputKey.getValue().length <8){
				new Notice('8 characters minimum!')
				return
			}
			if(inputKey.getValue() !== confirmKey.getValue()){
				new Notice('confirmation key wrong!');
				return;
			}
			this.app.vault.read(currentFile).then(text=>{
				 const key = inputKey.getValue()
				 const encrypted = aes.encrypt(text, key);
				 return this.app.vault.modify(currentFile,encrypted.toString())
			})
			.then(()=>{
				this.close()
			})
		})
		console.log(modalEl)

	}

	onClose() {
		let {contentEl} = this;
		contentEl.empty();
	}

}

class DecryptionModal extends Modal{
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const currentView = this.app.workspace.activeLeaf.view as MarkdownView;
		const currentFile = currentView.file
		const filename=currentFile.name
		let {modalEl,titleEl,contentEl} = this;
		titleEl.setText(`Decrypt: ${filename}`);
		contentEl.addClass("encryption")
		var inputKey = new TextComponent(contentEl).setPlaceholder("Enter key ... ")
		inputKey.inputEl.type="password"
		new ButtonComponent(contentEl).setButtonText("Decrypt").onClick(()=>{
			this.app.vault.read(currentFile).then(text=>{
				var decrypted = aes.decrypt(text, inputKey.getValue()).toString(CryptoJS.enc.Utf8);
				return this.app.vault.modify(currentFile,decrypted)
			})
			.then(()=>{
				this.close()
			})
			.catch(err=>{
				new Notice("Wrong key")
				console.log(err)
			})
		})
		// console.log(modalEl)

	}

	onClose() {
		let {contentEl} = this;
		contentEl.empty();
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
