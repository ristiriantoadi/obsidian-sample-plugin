import { App, Modal, Notice, Plugin, PluginSettingTab, Setting,MarkdownView,normalizePath, TextComponent,ButtonComponent, TFile } from 'obsidian';
import aes from 'crypto-js/aes';
import CryptoJS from "crypto-js/core";
import { start } from 'repl';
// import CodeMirror from "codemirror";
interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	//timestamp plugin variables
	startLineofCurrentBlock:number=0
	firstChangeTime:string="-1"
	lastChangeTime:string
	currentFile:TFile
	changed:boolean=false
	count:number=0
	
	formatDate(date:Date):string{
		var getYear:string = date.getFullYear().toString();
        var getMonth:string = date.getMonth()+1 < 10 ? `0${date.getMonth()+1}`:`${date.getMonth()+1}`;	
        var getDate:string = date.getDate() < 10 ? `0${date.getDate()}`:`${date.getDate()}`
		var getHour:string = date.getHours()< 10 ? `0${date.getHours()}`:`${date.getHours()}`
		var getMinute:string = date.getMinutes()< 10 ? `0${date.getMinutes()}`:`${date.getMinutes()}`
		return  `${getYear}-${getMonth}-${getDate} ${getHour}:${getMinute}`
    }
	
	getStartLineOfCurrentBlock(cm:CodeMirror.Editor):number{
		const cursorLine = cm.getCursor().line
		const lines = cm.getValue().split("\n")
		
		//get start of block
		var currentLine = cursorLine;
		var startLineOfCurrentBlock = currentLine;
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

		this.addRibbonIcon('dice', 'Encryption', () => {
			new EncryptionModal(this.app).open()
		});

		this.addRibbonIcon('dice', 'Decryption', () => {
			new DecryptionModal(this.app).open()
		});

		this.addStatusBarItem().setText('Status Bar Text');

		this.addSettingTab(new SampleSettingTab(this.app, this));

		this.registerCodeMirror((cm: CodeMirror.Editor) => {
			const app = this.app
			cm.on("change",(cm,co)=>{
				const changeTime = this.formatDate(new Date())
				const startLineOfCurrentBlock = this.getStartLineOfCurrentBlock(cm);
				const lines = cm.getValue().split("\n")
				if(lines[startLineOfCurrentBlock]){
					// console.log("called")
					const leaf = app.workspace.activeLeaf;
					if(!leaf)
						return;
					const currentView = leaf.view as MarkdownView;
					const currentFile = currentView.file
					var newContent:string="";
					if(!lines[startLineOfCurrentBlock].startsWith("^")){
						var timestamp = `^{created:${changeTime},updated:${changeTime}}\n`
						for(var n = 0;n<lines.length;n++){
							if(n == startLineOfCurrentBlock){
								newContent+=timestamp
							}
							newContent+=lines[n]+"\n";
						}
						const cursorPos = cm.getCursor()
						this.app.vault.modify(currentFile,newContent).then(()=>{
							cursorPos.line +=1 
							cm.setCursor(cursorPos)
						})
					}else{
						lines[startLineOfCurrentBlock] = lines[startLineOfCurrentBlock]
						.replace(/updated:[0-9]+-[0-9]+-[0-9]+ [0-9]+:[0-9]+/,`updated:${changeTime}`)
						newContent = lines.join("\n")
						this.app.vault.modify(currentFile,newContent)
					}
				}
			})
		})

		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			const view = this.app.workspace.activeLeaf.view as MarkdownView
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
