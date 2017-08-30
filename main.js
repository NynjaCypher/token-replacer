const YAML = require('yamljs')
const _ = require('lodash')
const glob = require('glob')
const exec = require('child_process').exec
const propertiesParser = require('properties-parser')

let configPath = process.env.CONFIG_PATH
if(configPath === undefined)
	configPath = '/config/config.yml'
const config = YAML.load(configPath)

let globals
if(_.has(config, 'globals') && _.isObject(config.globals))
	globals = config.globals
	
let envFilter
if(_.has(config, 'envFilter'))
	envFilter = config.envFilter
	
let handled = []

let targets
if(_.has(config, 'files') && _.isObject(config.files))
	targets = config.files
else
	throw new Error('No \'files\' block found!')
	
for(g in targets) {
	let provided = targets[g] // provided by individual variables
	if(!_.isObject(provided))
		provided = {}
	for(k in provided) {
		if(k == 'files' && _.isArray(provided[k])) {
			for(f in provided[k].files) {
				Object.assign(provided, propertiesParser.parse(f))
			}
		}
	}
	
	let env = {} // provided by environment vars
	if(_.isArray(envFilter)) {
		if(envFilter.length > 0) {
			for(e in envFilter) {
				if(_.has(process.env, e))
					env.push(process.env[e])
			}
		}else Object.assign(env, process.env)
	}
	
	let vars = Object.assign({}, env, globals, provided) // final env collection
	
	glob(g, { cwd: '/' }, (err, files) => {
		if(err)
		  throw err
		
		files.filter((file) => !handled.includes(file)).forEach((file) => {
			handled.push(file)
			exec(generateCommand(file, vars), { cwd: '/' }, (error, stdout, stderr) => {
				if(error)
					throw error
					
				console.log('Tokens in file \'' + file + '\' replaced.')
			})
		})
	})
}

function generateCommand(file, variables) {
	let str = 'sed '
	for(k in variables) {
		str += '-e \'s/\${' + k + '}/' + variables[k] + '/g\' '
	}
	
	str += file + ' > ' + file + '.tmp && mv ' + file + '.tmp ' + file
	return str
}