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

		this.addCommand({
			id: 'read-current-file',
			name: 'Read current file',
			// callback: () => {
			// 	console.log('Simple Callback');
			// },
			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf) {
					if (!checking) {
						const currentView = leaf.view as MarkdownView;
        				const currentFile = currentView.file
						this.app.vault.read(currentFile).then(data=>{
							// console.log(data.match(/(?<=---\n)(.*)(?=---)/s)[0].toString())//metadata
							var metadata = data.match(/(---)(.*)(---)/s)[0].toString();
							var yaml = metadata.match(/(?<=---\n)(.*)(?=---)/s)[0].toString();
							var content  = data.split(metadata)[1].toString()
							console.log(yaml)
							console.log(content)
						})
						// const fileCache = this.app.metadataCache.getFileCache(currentFile)
						// const frontMatterCache = fileCache.frontmatter
						// console.log("frontMatterCache",frontMatterCache)
					}
					return true;
				}
				return false;
			}
		});

		this.registerCodeMirror((cm: CodeMirror.Editor) => {
			cm.on("change",(cm,co)=>{
				return;
				const changeTime = this.formatDate(new Date())
				const startLineOfCurrentBlock = this.getStartLineOfCurrentBlock(cm);
				const lines = cm.getValue().split("\n")
				if(lines[startLineOfCurrentBlock]){
					const leaf = this.app.workspace.activeLeaf;
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
	}

	onunload() {
		console.log('unloading plugin');
	}
}