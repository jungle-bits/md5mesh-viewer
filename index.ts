import * as twgl from "twgl.js";
import { glMatrix, mat4 } from "gl-matrix";
import {
    RenderingMesh,
    MeshTextures,
    getRenderingMeshes,
    getRenderingJoints,
    getRenderingTriangleNormals,
    getRenderingVertexNormals,
    getRenderingMeshTriangles,
    getRenderingTriangleTangents,
    getRenderingTriangleBitangents,
    getRenderingVertexTangents,
    getRenderingVertexBitangents
} from "./rendering";
import { getModel } from "./md5meshParser";
import { initSettingsUI, getSettings } from "./settingsUI";
import * as input from "./input";

const canvas = document.getElementById("glcanvas") as HTMLCanvasElement;
twgl.resizeCanvasToDisplaySize(canvas);

const gl = canvas.getContext("webgl") as WebGLRenderingContext;
if (!gl) {
    throw new Error("WebGL not supported");
}

gl.clearColor(0.9, 0.9, 0.9, 1);
gl.enable(gl.DEPTH_TEST);
gl.enable(gl.CULL_FACE);
gl.frontFace(gl.CW);
gl.cullFace(gl.BACK);

const md5meshSource = require("./models/zfat.md5mesh") as string;
const md5Mesh = getModel(md5meshSource);

const joints = getRenderingJoints(gl, md5Mesh);
const triangleNormals = getRenderingTriangleNormals(gl, md5Mesh);
const triangleTangents = getRenderingTriangleTangents(gl, md5Mesh);
const triangleBitangents = getRenderingTriangleBitangents(gl, md5Mesh);
const vertexNormals = getRenderingVertexNormals(gl, md5Mesh);
const vertexTangents = getRenderingVertexTangents(gl, md5Mesh);
const vertexBitangents = getRenderingVertexBitangents(gl, md5Mesh);
const meshTriangles = getRenderingMeshTriangles(gl, md5Mesh);
const meshes = getRenderingMeshes(gl, md5Mesh);

const createProgramInfo = (name: string) => twgl.createProgramInfo(gl, [
    require(`./shaders/${name}-vertex.glslx`) as string,
    require(`./shaders/${name}-fragment.glslx`) as string
]);

const solidProgramInfo = createProgramInfo("solid");
const flatProgramInfo = createProgramInfo("flat");
const shadedProgramInfo = createProgramInfo("shaded");
const textureProgramInfo = createProgramInfo("texture");
const mainProgramInfo = createProgramInfo("main");

const lightBufferInfo = twgl.createBufferInfoFromArrays(gl, { position: [0, 0, 0] });

const cameraPosition = [0, 100, 100];
const center = [0, 40, 0];
const matrices = {
    u_worldMatrix: mat4.identity(mat4.create()),
    u_viewMatrix: mat4.lookAt(mat4.create(), cameraPosition, center, [0, 1, 0]),
    u_projMatrix: mat4.create()
};

function setProjectionMatrix(width: number, height: number) {
    mat4.perspective(matrices.u_projMatrix, glMatrix.toRadian(45), width / height, 0.1, 1000);
}

setProjectionMatrix(canvas.width, canvas.height);

window.onresize = () => {
    twgl.resizeCanvasToDisplaySize(canvas);
    const {width, height} = canvas;
    gl.viewport(0, 0, width, height);
    setProjectionMatrix(width, height);
};

function renderJoints() {
    gl.useProgram(solidProgramInfo.program);
    twgl.setUniforms(solidProgramInfo, {
        ...matrices,
        u_color: [1, 0, 0]
    });

    twgl.setBuffersAndAttributes(gl, solidProgramInfo, joints.bufferInfo);
    gl.drawArrays(gl.LINES, 0, joints.bufferInfo.numElements);
}

const renderVectors = (renderingMesh: RenderingMesh, color: number[]) => {
    twgl.setUniforms(solidProgramInfo, {u_color: color});
    twgl.setBuffersAndAttributes(gl, solidProgramInfo, renderingMesh.bufferInfo);
    gl.drawArrays(gl.LINES, 0, renderingMesh.bufferInfo.numElements);
};

function renderTriangleNormals(i: number) {
    gl.useProgram(solidProgramInfo.program);
    twgl.setUniforms(solidProgramInfo, matrices);

    renderVectors(triangleNormals[i], [0, 0, 1]);
    renderVectors(triangleTangents[i], [0, 1, 0]);
    renderVectors(triangleBitangents[i], [1, 0, 0]);
}

function renderVertexNormals(i: number) {
    gl.useProgram(solidProgramInfo.program);
    twgl.setUniforms(solidProgramInfo, matrices);

    renderVectors(vertexNormals[i], [0, 0, 1]);
    renderVectors(vertexTangents[i], [0, 1, 0]);
    renderVectors(vertexBitangents[i], [1, 0, 0]);
}

function renderVertices(bufferInfo: twgl.BufferInfo) {
    gl.useProgram(solidProgramInfo.program);
    twgl.setUniforms(solidProgramInfo, {
        ...matrices,
        u_color: [1.0, 0.5, 0],
        u_pointSize: 3
    });

    twgl.setBuffersAndAttributes(gl, solidProgramInfo, bufferInfo);
    twgl.drawBufferInfo(gl, bufferInfo, gl.POINTS);
}

function renderFlatTriangles(i: number) {
    const { bufferInfo } = meshTriangles[i];
    gl.useProgram(flatProgramInfo.program);
    twgl.setUniforms(flatProgramInfo, {
        ...matrices,
        u_lightPosition: input.getLightPosition(),
        u_color: [1, 1, 1]
    });

    twgl.setBuffersAndAttributes(gl, flatProgramInfo, bufferInfo);
    gl.drawArrays(gl.TRIANGLES, 0, bufferInfo.numElements);
}

function renderTexture(programInfo: twgl.ProgramInfo, bufferInfo: twgl.BufferInfo, texture: WebGLTexture) {
    gl.useProgram(programInfo.program);
    twgl.setUniforms(programInfo, {
        ...matrices,
        u_lightPosition: input.getLightPosition(),
        u_sampler: texture
    });

    twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);

    gl.drawElements(gl.TRIANGLES, bufferInfo.numElements, gl.UNSIGNED_SHORT, 0);
}

function renderMesh(programInfo: twgl.ProgramInfo, bufferInfo: twgl.BufferInfo, textures: MeshTextures) {
    gl.useProgram(programInfo.program);
    twgl.setUniforms(programInfo, {
        ...matrices,
        u_color: [1, 1, 1],
        u_lightPosition: input.getLightPosition(),
        u_sampler_height: textures.h,
        u_sampler_diffuse: textures.d,
        u_sampler_specular: textures.s,
    });

    twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);

    gl.drawElements(gl.TRIANGLES, bufferInfo.numElements, gl.UNSIGNED_SHORT, 0);
}

function renderLight() {
    gl.useProgram(solidProgramInfo.program);
    const worldMatrix = mat4.translate(mat4.create(), mat4.identity(mat4.create()), input.getLightPosition());
    twgl.setUniforms(solidProgramInfo, {
        u_worldMatrix: worldMatrix,
        u_viewMatrix: matrices.u_viewMatrix,
        u_projMatrix: matrices.u_projMatrix,
        u_color: [1, 0, 0],
        u_pointSize: 10
    });

    twgl.setBuffersAndAttributes(gl, solidProgramInfo, lightBufferInfo);
    twgl.drawBufferInfo(gl, lightBufferInfo, gl.POINTS);
}

const identity = mat4.identity(mat4.create());

input.init();
initSettingsUI(md5Mesh);

function render() {
    const angleX = input.update();
    const angleY = Math.PI * 1.5;
    mat4.rotateY(matrices.u_worldMatrix, identity, angleX);
    mat4.rotateX(matrices.u_worldMatrix, matrices.u_worldMatrix, angleY);

    gl.clear(gl.COLOR_BUFFER_BIT);

    const settings = getSettings();

    renderLight();

    if (settings.skeleton) {
        renderJoints();
    }

    meshes
        .forEach((mesh, i) => {
            const enabled = settings.meshes[i];
            if (!enabled) {
                return;
            }

            if (settings.vertices) {
                renderVertices(mesh.bufferInfo);
            }

            if (settings.triangleNormals) {
                renderTriangleNormals(i);
            }

            if (settings.vertexNormals) {
                renderVertexNormals(i);
            }

            if (settings.flatGeometry) {
                renderFlatTriangles(i);
            }

            if (settings.shadedGeometry) {
                renderMesh(shadedProgramInfo, mesh.bufferInfo, mesh.textures);
            }

            if (settings.texture) {
                renderTexture(textureProgramInfo, mesh.bufferInfo, mesh.textures[settings.textureType]);
            }

            if (settings.full) {
                renderMesh(mainProgramInfo, mesh.bufferInfo, mesh.textures);
            }
        });

    requestAnimationFrame(render);
}

requestAnimationFrame(render);
