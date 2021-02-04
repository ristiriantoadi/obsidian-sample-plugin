import {Plugin,MarkdownView, TFile} from 'obsidian';
import { start } from 'repl';
import YAML from 'yaml'

export default class MyPlugin extends Plugin {

	globalTimeOut:any=null
	
	formatDate(date:Date):string{
		var getYear:string = date.getFullYear().toString();
        var getMonth:string = date.getMonth()+1 < 10 ? `0${date.getMonth()+1}`:`${date.getMonth()+1}`;	
        var getDate:string = date.getDate() < 10 ? `0${date.getDate()}`:`${date.getDate()}`
		var getHour:string = date.getHours()< 10 ? `0${date.getHours()}`:`${date.getHours()}`
		var getMinute:string = date.getMinutes()< 10 ? `0${date.getMinutes()}`:`${date.getMinutes()}`
		var getSecond:string = date.getSeconds()< 10 ? `0${date.getSeconds()}`:`${date.getSeconds()}`
		return  `${getYear}-${getMonth}-${getDate} ${getHour}:${getMinute}:${getSecond}`
	}
	
	generateUniqueBlockId(){
		return '^' + Math.random().toString(36).substr(2, 9);
	}
	
	getStartLineOfCurrentBlock(cm:CodeMirror.Editor):number{
		const cursorLine = cm.getCursor().line
		const lines = cm.getValue().split("\n")
		//get start of block
		var currentLine = cursorLine;
		var startLineOfCurrentBlock = currentLine;
		while(currentLine>=0){
			if(lines[currentLine] == '')
				break
			if(lines[currentLine] == '---')
				break
			if(lines[currentLine] == "```")
				break
			startLineOfCurrentBlock=currentLine;
			currentLine--;
		}
		return startLineOfCurrentBlock;
	}

	createNewBlock(yamlObject:any,changeTime:string,lines:string[],startLineOfCurrentBlock:number,cm:CodeMirror.Editor,currentFile:TFile){
		var blockId = this.generateUniqueBlockId()
		var noYaml=false
		var noBlockTimestamp=false
		if(yamlObject == undefined || yamlObject == null){
			yamlObject = new Object()
			noYaml=true;
		}
		if(yamlObject.blockTimestamp == undefined || 
			yamlObject.blockTimestamp == null){
			noBlockTimestamp=true
			yamlObject.blockTimestamp = new Array()
		}
		yamlObject.blockTimestamp.push({id:blockId,created:changeTime,modified:changeTime})
		var newContent=""
		for(var n = 0;n<lines.length;n++){
			if(n == startLineOfCurrentBlock){
				newContent+=blockId+"\n"
			}
			newContent+=lines[n]+"\n";
		}
		var yamlString = YAML.stringify(yamlObject)//yamlString already include end newline
		if(!noYaml){
			//replace yaml front matter if it exist
			newContent = newContent.replace(/(?<=---\n)(.*)(?=---)/s,yamlString)
		}
		else{
			//prepend metadata to content
			newContent = "---\n"+yamlString+"---\n"+newContent
		}
		const cursorPos = cm.getCursor()
		this.app.vault.modify(currentFile,newContent).then(()=>{
			var addedNewContentLength = 4//1 for the new block id in the content, 3 for metadata timestamp in the yaml 
			if(noYaml){
				addedNewContentLength += 2 // for the closing and opening line of the metadata
			}
			if(noBlockTimestamp){
				addedNewContentLength +=1 //for the blocktimestamp key
			}
			cursorPos.line +=(addedNewContentLength) 
			cm.setCursor(cursorPos)
		})
	}

	updateBlock(yamlObject:any,changeTime:string,startLineOfCurrentBlock:number,lines:string[],currentFile:TFile){
		if(yamlObject){
			if(yamlObject.blockTimestamp){
				yamlObject.blockTimestamp = yamlObject.blockTimestamp.map((b:any)=>{
					if(b.id == lines[startLineOfCurrentBlock]){
						b.modified=changeTime
					}
					return b
				})
				var yamlString = YAML.stringify(yamlObject)
				var newContent = lines.join("\n")
				newContent = newContent.replace(/(?<=---\n)(.*)(?=---)/s,yamlString)
				this.app.vault.modify(currentFile,newContent) 
			}
		}
	}

	//this seems to be where the plugin started
	async onload() {
		console.log('loading plugin');
		this.registerCodeMirror((cm: CodeMirror.Editor) => {
			cm.setOption("pollInterval",5000)
			cm.on("change",(cm,co)=>{
				const changeTime = this.formatDate(new Date())
				const startLineOfCurrentBlock = this.getStartLineOfCurrentBlock(cm);
				const data = cm.getValue()
				const lines = data.split("\n")

				if(startLineOfCurrentBlock == 0 && lines[startLineOfCurrentBlock].startsWith("---")){
					//cursor is in the metadata
					return;
				}

				if(lines[startLineOfCurrentBlock]){
					//get yaml as object
					const leaf = this.app.workspace.activeLeaf;
					if(!leaf)
						return;
					const currentView = leaf.view as MarkdownView;
					const currentFile = currentView.file
					var metadata = data.match(/(---)(.*)(---)/s);
					var yamlString = ""
					if(metadata){
						yamlString = metadata[0].match(/(?<=---\n)(.*)(?=\n---)/s)[0];
					}
					var yamlObject = YAML.parse(yamlString)

					if(!lines[startLineOfCurrentBlock].startsWith("^")){
						if(this.globalTimeOut !=null) clearTimeout(this.globalTimeOut)
						this.globalTimeOut = setTimeout(()=>this.createNewBlock(yamlObject,changeTime,lines,startLineOfCurrentBlock,cm,currentFile),200)
					}else{
						if(this.globalTimeOut !=null) clearTimeout(this.globalTimeOut)
						this.globalTimeOut = setTimeout(()=>this.updateBlock(yamlObject,changeTime,startLineOfCurrentBlock,lines,currentFile),200)
					}
				}
			})
		})
	}

	onunload() {
		console.log('unloading plugin');
	}
}